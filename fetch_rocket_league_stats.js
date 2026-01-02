const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

async function fetchRocketLeagueStats() {
  let browser;
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({ 
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    
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
    
    const outputPath = path.join(__dirname, 'rocket_league_stats.json');
    fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
    console.log('✅ Rocket League stats fetched successfully!');
    
    await browser.close();
    return stats;
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    if (browser) await browser.close();
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
  }

  // Extract Peak Rating - look for the peak-rating section
  const peakMatch = html.match(/peak-rating.*?alt="([^"]+)".*?value">(\d{3,4})<.*?Season\s+(\d+)/s);
  if (peakMatch) {
    stats.peakRating.rank = peakMatch[1];
    stats.peakRating.rating = parseInt(peakMatch[2]);
    stats.peakRating.season = `Season ${peakMatch[3]}`;
  }

  // Extract Lifetime Stats - looking for title="Wins" pattern
  const winsMatch = html.match(/title="Wins".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (winsMatch) {
    stats.lifetime.wins = parseInt(winsMatch[1].replace(/,/g, ''));
    stats.lifetime.winsRank = `Top ${winsMatch[2]}%`;
  }

  const goalsMatch = html.match(/title="Goals".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (goalsMatch) {
    stats.lifetime.goals = parseInt(goalsMatch[1].replace(/,/g, ''));
    stats.lifetime.goalsRank = `Top ${goalsMatch[2]}%`;
  }

  const shotsMatch = html.match(/title="Shots".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (shotsMatch) {
    stats.lifetime.shots = parseInt(shotsMatch[1].replace(/,/g, ''));
    stats.lifetime.shotsRank = `Top ${shotsMatch[2]}%`;
  }

  const savesMatch = html.match(/title="Saves".*?value">([\d,]+)<.*?Top\s+([\d.]+)%/s);
  if (savesMatch) {
    stats.lifetime.saves = parseInt(savesMatch[1].replace(/,/g, ''));
    stats.lifetime.savesRank = `Top ${savesMatch[2]}%`;
  }

  const ratioMatch = html.match(/title="Goal Shot Ratio".*?value">([\d.]+)<.*?Top\s+([\d.]+)%/s);
  if (ratioMatch) {
    stats.lifetime.goalShotRatio = parseFloat(ratioMatch[1]);
    stats.lifetime.goalShotRatioRank = `Top ${ratioMatch[2]}%`;
  }

  return stats;
}

// Run if called directly
if (require.main === module) {
  fetchRocketLeagueStats()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fetchRocketLeagueStats;
