const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

function fileExists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function isServerlessEnv() {
  return !!(
    process.env.AWS_REGION ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.NETLIFY ||
    process.env.VERCEL
  );
}

function getLocalBrowserCandidates() {
  const candidates = [];

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);
  }
  if (process.env.CHROME_EXECUTABLE_PATH) {
    candidates.push(process.env.CHROME_EXECUTABLE_PATH);
  }

  if (process.platform === 'win32') {
    candidates.push(
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }

  return candidates.filter(fileExists);
}

async function resolveLaunchOptions() {
  // Use Lambda/Vercel-friendly Chromium in serverless envs
  if (isServerlessEnv()) {
    return {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    };
  }

  // Local dev: prefer a system-installed Chrome/Edge
  const candidates = getLocalBrowserCandidates();
  if (candidates.length > 0) {
    const chosen = candidates[0];
    console.log(`🧭 Using local browser: ${chosen}`);
    return {
      args: [
        // Keep args minimal for local; no Lambda flags
      ],
      executablePath: chosen,
      headless: 'new',
    };
  }

  // Final fallback: try @sparticuz/chromium even locally (may fail on Windows)
  try {
    const execPath = await chromium.executablePath();
    if (fileExists(execPath)) {
      console.log(`🧭 Fallback to chromium binary: ${execPath}`);
      return {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath,
        headless: chromium.headless,
      };
    }
  } catch {}

  throw new Error(
    'Could not find a Chrome/Edge executable. Set PUPPETEER_EXECUTABLE_PATH or CHROME_EXECUTABLE_PATH to a valid browser binary.'
  );
}

async function fetchRocketLeagueStats() {
  let browser;
  try {
    console.log('🚀 Launching browser...');
    const launchOptions = await resolveLaunchOptions();
    browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 Navigating to profile page...');
    await page.goto('https://rocketleague.tracker.network/rocket-league/profile/epic/TKNclaudette/overview', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content to load
    console.log('⏳ Waiting for stats to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const html = await page.content();
    
    const stats = parseStats(html);
    
    // Validate that we actually got data (check if rank is not 'Unknown')
    if (stats.rankedDuel.rank === 'Unknown' && stats.rankedDuel.rating === 0) {
      // Log diagnostic information
      console.log('🔍 Diagnostic Info:');
      console.log('  - HTML length:', html.length);
      console.log('  - Contains "Ranked Duel 1v1":', html.includes('Ranked Duel 1v1'));
      console.log('  - Contains "peak-rating":', html.includes('peak-rating'));
      
      // Save HTML for debugging only when parsing fails
      const debugHtmlPath = path.join(__dirname, 'debug_html.txt');
      try {
        fs.writeFileSync(debugHtmlPath, html);
        console.log(`  - HTML saved to ${debugHtmlPath} for inspection`);
      } catch (err) {
        console.warn('  - ⚠️ Failed to save debug HTML:', err.message);
      }
      
      throw new Error('Failed to parse stats - got default values. HTML parsing may have failed.');
    }
    
    const outputPath = path.join(__dirname, 'rocket_league_stats.json');
    fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
    console.log('✅ Rocket League stats fetched successfully!');
    
    await browser.close();
    return stats;
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    console.error('Stack:', error.stack);
    if (browser) await browser.close();
    
    // Don't overwrite existing stats file on error - keep the committed version
    const outputPath = path.join(__dirname, 'rocket_league_stats.json');
    if (fs.existsSync(outputPath)) {
      console.log('ℹ️ Keeping existing stats file due to fetch error');
    }
    
    throw error;
  }
}

function parseStats(html) {
  const stats = {
    rankedDuel: {
      rank: 'Unknown',
      rating: 0,
      division: '',
      percentile: ''
    },
    peakRating: {
      rank: 'Unknown',
      rating: 0,
      season: ''
    },
    lifetime: {
      wins: 0,
      goals: 0,
      shots: 0,
      saves: 0,
      goalShotRatio: 0,
      winsRank: '',
      goalsRank: '',
      shotsRank: '',
      savesRank: '',
      goalShotRatioRank: ''
    },
    lastUpdated: new Date().toISOString()
  };

  function parseLifetimeStat(title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const valueRegex = new RegExp(
      `title="${escapedTitle}"[^>]*>[\\s\\S]{0,300}?class="value">([\\d,.]+)<`,
      's'
    );
    const valueMatch = html.match(valueRegex);
    if (!valueMatch) {
      return null;
    }

    // Percentiles are often hidden behind expandable UI, so keep this optional.
    const surroundingStart = Math.max(0, valueMatch.index - 400);
    const surroundingEnd = Math.min(html.length, valueMatch.index + 600);
    const surrounding = html.slice(surroundingStart, surroundingEnd);
    const percentileMatch = surrounding.match(/Top\s+([\d.]+)%/);

    return {
      value: valueMatch[1],
      percentile: percentileMatch ? `Top ${percentileMatch[1]}%` : ''
    };
  }

  // Extract Ranked Duel 1v1 current stats from the current-rating block.
  const duelMatch = html.match(
    /Ranked Duel 1v1[\s\S]{0,3000}?Current[\s\S]{0,1200}?alt="([^"]+)"[\s\S]{0,700}?class="value">([\d,]+)</s
  );
  if (duelMatch) {
    stats.rankedDuel.rank = duelMatch[1];
    stats.rankedDuel.rating = parseInt(duelMatch[2].replace(/,/g, ''), 10);

    const duelWindowStart = Math.max(0, duelMatch.index - 300);
    const duelWindowEnd = Math.min(html.length, duelMatch.index + 900);
    const duelWindow = html.slice(duelWindowStart, duelWindowEnd);
    const duelPercentileMatch = duelWindow.match(/Top\s+([\d.]+)%/);
    if (duelPercentileMatch) {
      stats.rankedDuel.percentile = `Top ${duelPercentileMatch[1]}%`;
    }

    console.log('✓ Parsed Ranked Duel stats');
  } else {
    console.log('✗ Failed to parse Ranked Duel stats');
  }

  // Extract Peak Rating from dedicated widget area before Ranked Duel section.
  const peakWidgetStart = html.indexOf('peak-rating-widget');
  const rankedSectionStart = html.indexOf('Ranked Duel 1v1');
  const peakSection =
    peakWidgetStart >= 0 && rankedSectionStart > peakWidgetStart
      ? html.slice(peakWidgetStart, rankedSectionStart)
      : html;

  const peakMatch = peakSection.match(
    /Peak Rating[\s\S]{0,2500}?alt="([^"]+)"[\s\S]{0,1200}?class="value">([\d,]+)<[\s\S]{0,700}?(?:Season\s*(\d+))/s
  );
  if (peakMatch) {
    stats.peakRating.rank = peakMatch[1];
    stats.peakRating.rating = parseInt(peakMatch[2].replace(/,/g, ''), 10);
    stats.peakRating.season = `Season ${peakMatch[3]}`;
    console.log('✓ Parsed Peak Rating stats');
  } else {
    console.log('✗ Failed to parse Peak Rating stats');
  }

  // Extract Lifetime Stats from stat cards by title and value.
  const winsMatch = parseLifetimeStat('Wins');
  if (winsMatch) {
    stats.lifetime.wins = parseInt(winsMatch.value.replace(/,/g, ''), 10);
    stats.lifetime.winsRank = winsMatch.percentile;
    console.log('✓ Parsed Wins stats');
  } else {
    console.log('✗ Failed to parse Wins stats');
  }

  const goalsMatch = parseLifetimeStat('Goals');
  if (goalsMatch) {
    stats.lifetime.goals = parseInt(goalsMatch.value.replace(/,/g, ''), 10);
    stats.lifetime.goalsRank = goalsMatch.percentile;
    console.log('✓ Parsed Goals stats');
  } else {
    console.log('✗ Failed to parse Goals stats');
  }

  const shotsMatch = parseLifetimeStat('Shots');
  if (shotsMatch) {
    stats.lifetime.shots = parseInt(shotsMatch.value.replace(/,/g, ''), 10);
    stats.lifetime.shotsRank = shotsMatch.percentile;
    console.log('✓ Parsed Shots stats');
  } else {
    console.log('✗ Failed to parse Shots stats');
  }

  const savesMatch = parseLifetimeStat('Saves');
  if (savesMatch) {
    stats.lifetime.saves = parseInt(savesMatch.value.replace(/,/g, ''), 10);
    stats.lifetime.savesRank = savesMatch.percentile;
    console.log('✓ Parsed Saves stats');
  } else {
    console.log('✗ Failed to parse Saves stats');
  }

  const ratioMatch = parseLifetimeStat('Goal Shot Ratio');
  if (ratioMatch) {
    stats.lifetime.goalShotRatio = parseFloat(ratioMatch.value.replace(/,/g, ''));
    stats.lifetime.goalShotRatioRank = ratioMatch.percentile;
    console.log('✓ Parsed Goal Shot Ratio stats');
  } else {
    console.log('✗ Failed to parse Goal Shot Ratio stats');
  }

  return stats;
}

// Run if called directly
if (require.main === module) {
  fetchRocketLeagueStats()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      console.warn('⚠️ Failed to fetch stats, preserving existing data. Workflow will succeed.');
      // Exit with success since we keep existing stats file on error
      process.exit(0);
    });
}

module.exports = fetchRocketLeagueStats;
