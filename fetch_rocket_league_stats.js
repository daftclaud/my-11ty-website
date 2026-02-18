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

  // Extract Ranked Duel 1v1 current stats - more flexible pattern
  // Look for the Ranked Duel 1v1 section with the rating value
  const duelMatch = html.match(/Ranked Duel 1v1.*?alt="([^"]+)".*?class="value">(\d+)<.*?Bottom\s+([\d.]+)%/s);
  if (duelMatch) {
    stats.rankedDuel.rank = duelMatch[1];
    stats.rankedDuel.rating = parseInt(duelMatch[2]);
    stats.rankedDuel.percentile = `Top ${duelMatch[3]}%`;
    console.log('✓ Parsed Ranked Duel stats');
  } else {
    console.log('✗ Failed to parse Ranked Duel stats');
  }

  // Extract Peak Rating - look for the peak-rating section
  const peakMatch = html.match(/peak-rating.*?alt="([^"]+)".*?value">(\d{3,4})<.*?Season\s+(\d+)/s);
  if (peakMatch) {
    stats.peakRating.rank = peakMatch[1];
    stats.peakRating.rating = parseInt(peakMatch[2]);
    stats.peakRating.season = `Season ${peakMatch[3]}`;
    console.log('✓ Parsed Peak Rating stats');
  } else {
    console.log('✗ Failed to parse Peak Rating stats');
  }

  // Extract Lifetime Stats - looking for title="Wins" pattern
  const winsMatch = html.match(/title="Wins".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (winsMatch) {
    stats.lifetime.wins = parseInt(winsMatch[1].replace(/,/g, ''));
    stats.lifetime.winsRank = `Top ${winsMatch[2]}%`;
    console.log('✓ Parsed Wins stats');
  } else {
    console.log('✗ Failed to parse Wins stats');
  }

  const goalsMatch = html.match(/title="Goals".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (goalsMatch) {
    stats.lifetime.goals = parseInt(goalsMatch[1].replace(/,/g, ''));
    stats.lifetime.goalsRank = `Top ${goalsMatch[2]}%`;
    console.log('✓ Parsed Goals stats');
  } else {
    console.log('✗ Failed to parse Goals stats');
  }

  const shotsMatch = html.match(/title="Shots".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (shotsMatch) {
    stats.lifetime.shots = parseInt(shotsMatch[1].replace(/,/g, ''));
    stats.lifetime.shotsRank = `Top ${shotsMatch[2]}%`;
    console.log('✓ Parsed Shots stats');
  } else {
    console.log('✗ Failed to parse Shots stats');
  }

  const savesMatch = html.match(/title="Saves".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (savesMatch) {
    stats.lifetime.saves = parseInt(savesMatch[1].replace(/,/g, ''));
    stats.lifetime.savesRank = `Top ${savesMatch[2]}%`;
    console.log('✓ Parsed Saves stats');
  } else {
    console.log('✗ Failed to parse Saves stats');
  }

  const ratioMatch = html.match(/title="Goal Shot Ratio".*?value">([\d.]+)<.*?Top\s+([\d.]+)%/s);
  if (ratioMatch) {
    stats.lifetime.goalShotRatio = parseFloat(ratioMatch[1]);
    stats.lifetime.goalShotRatioRank = `Top ${ratioMatch[2]}%`;
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
