require('dotenv').config();
const util = require("util");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const Month = require("./src/_includes/month.11ty.js");
const CalendarGrid = require("./src/_includes/calendarGrid.11ty.js");

// Run Spanish word detection before build
function runSpanishWordDetection() {
  const scriptPath = path.join(__dirname, "detect_spanish_words.py");
  const pythonExecutable = path.join(__dirname, ".venv", "Scripts", "python.exe");
  
  try {
    if (fs.existsSync(scriptPath) && fs.existsSync(pythonExecutable)) {
      console.log("📊 Running Spanish word detection...");
      execSync(`"${pythonExecutable}" "${scriptPath}"`, { stdio: "inherit" });
    }
  } catch (error) {
    console.warn("⚠️ Spanish word detection failed:", error.message);
  }
}

// Fetch Rocket League stats before build
function fetchRocketLeagueStats() {
  // Skip fetching on Vercel/Netlify - use committed stats file instead
  if (process.env.VERCEL || process.env.NETLIFY || process.env.CI) {
    console.log("⏭️ Skipping Rocket League stats fetch in CI/deployment environment");
    return;
  }
  
  const fetchScript = path.join(__dirname, "fetch_rocket_league_stats.js");
  
  try {
    if (fs.existsSync(fetchScript)) {
      console.log("🚗 Fetching Rocket League stats...");
      execSync(`node "${fetchScript}"`, { stdio: "inherit" });
    }
  } catch (error) {
    console.warn("⚠️ Rocket League stats fetch failed:", error.message);
  }
}

// Run content translation before build
function runContentTranslation() {
  const translateScript = path.join(__dirname, "translate-content.js");
  
  try {
    if (fs.existsSync(translateScript)) {
      console.log("🌐 Running content translation...");
      execSync(`node "${translateScript}"`, { stdio: "inherit" });
    }
  } catch (error) {
    console.warn("⚠️ Content translation failed:", error.message);
  }
}

// Run detection and translation before build starts
runSpanishWordDetection();
fetchRocketLeagueStats();
runContentTranslation();

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("./src/style.css");
  eleventyConfig.addPassthroughCopy("./src/assets");

  // Load i18n translations
  const i18nEn = require("./src/_data/i18n/en.json");
  const i18nEs = require("./src/_data/i18n/es-MX.json");
  const { loadCachedTranslation } = require("./translate-content.js");

  // Load filters
  require("./src/_includes/filters.js")(eleventyConfig);

  // Add i18n filter
  eleventyConfig.addFilter("t", function(key, locale = "en") {
    const translations = locale === "es" ? i18nEs : i18nEn;
    const keys = key.split(".");
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return value;
  });

  // Add filter to get translated pen data
  eleventyConfig.addFilter("getPenTranslation", function(penSlug, locale = "en") {
    if (locale === "en") {
      return null; // No translation needed for English
    }
    
    const cached = loadCachedTranslation(penSlug);
    return cached;
  });

  eleventyConfig.addFilter("console", function (value) {
    return util.inspect(value);
  });

  eleventyConfig.addFilter("formatDate", function (date, locale = "en-US") {
    if (!date) return "";

    // Coerce strings or other objects into Date
    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj) || !dateObj.getTime || isNaN(dateObj.getTime())) return "";

    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Chicago",
    };

    // Format date in America/Chicago timezone (CST/CDT - close to Monterrey, Mexico)
    return dateObj.toLocaleDateString(locale, options);
  });

  eleventyConfig.addFilter("formatNumber", function (num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  });

  eleventyConfig.addGlobalData("rocket_league_stats", function() {
    try {
      const statsPath = path.join(__dirname, 'rocket_league_stats.json');
      if (fs.existsSync(statsPath)) {
        const data = fs.readFileSync(statsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('⚠️ Could not load Rocket League stats:', error.message);
    }
    return null;
  });

  // Navigation helpers that compare by time value to avoid Date object identity issues
  eleventyConfig.addFilter("getPreviousCuration", function (collection, date) {
    if (!date) return null;
    const targetTime = new Date(date).getTime();
    const currentIndex = collection.findIndex((curation) => {
      const curTime = new Date(curation.date).getTime();
      return curTime === targetTime;
    });
    if (currentIndex > 0) {
      return collection[currentIndex - 1];
    }
    return null;
  });

  eleventyConfig.addFilter("getNextCuration", function (collection, date) {
    if (!date) return null;
    const targetTime = new Date(date).getTime();
    const currentIndex = collection.findIndex((curation) => {
      const curTime = new Date(curation.date).getTime();
      return curTime === targetTime;
    });
    if (currentIndex >= 0 && currentIndex < collection.length - 1) {
      return collection[currentIndex + 1];
    }
    return null;
  });

  eleventyConfig.addShortcode("calendar", function (data) {
    const grid = new CalendarGrid();
    return grid.render(data);
  });

  eleventyConfig.addFilter("getWordStats", function (collection) {
    const now = new Date();
    const allWords = [];
    const sources = {};
    const letterCount = {};
    const yearlyCount = {};
    const monthlyCount = {};

    // Process all curations
    collection.forEach((curation) => {
      const date = curation.data.date;
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return; // Skip curations with invalid dates
      }
      const year = date.getFullYear();
      const month = date.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });

      // Count by year
      yearlyCount[year] = (yearlyCount[year] || 0) + curation.data.words.length;

      // Count by month
      if (!monthlyCount[month]) {
        monthlyCount[month] = { wordCount: 0, sessionCount: 0, date: date };
      }
      monthlyCount[month].wordCount += curation.data.words.length;
      monthlyCount[month].sessionCount += 1;

      // Process each word
      curation.data.words.forEach((wordData) => {
        allWords.push({
          ...wordData,
          date: date,
        });

        // Count sources
        if (wordData.source) {
          sources[wordData.source] = (sources[wordData.source] || 0) + 1;
        }

        // Count by first letter
        const firstLetter = wordData.word.charAt(0).toUpperCase();
        letterCount[firstLetter] = (letterCount[firstLetter] || 0) + 1;
      });
    });

    // Sort years
    const yearlyBreakdown = Object.entries(yearlyCount)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year);

    const maxYearlyCount = Math.max(...yearlyBreakdown.map((y) => y.count));

    // Get top months
    const topMonths = Object.entries(monthlyCount)
      .map(([monthName, data]) => ({
        monthName,
        wordCount: data.wordCount,
        sessionCount: data.sessionCount,
        date: data.date,
      }))
      .sort((a, b) => b.wordCount - a.wordCount)
      .slice(0, 10);

    // Get top sources
    const topSources = Object.entries(sources)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Letter distribution (A-Z)
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const letterDistribution = alphabet.map((letter) => ({
      letter,
      count: letterCount[letter] || 0,
    }));
    const maxLetterCount = Math.max(
      ...letterDistribution.map((l) => l.count),
      1
    );

    // Get first and latest words
    const sortedWords = [...allWords].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const firstWord = sortedWords[0];
    const latestWord = sortedWords[sortedWords.length - 1];

    // Build daily breakdown (date string -> count)
    const dailyBreakdown = {};
    allWords.forEach((wordData) => {
      const date = wordData.date;
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return; // Skip words with invalid dates
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      dailyBreakdown[key] = (dailyBreakdown[key] || 0) + 1;
    });

    console.log('Daily breakdown generated with', Object.keys(dailyBreakdown).length, 'days');

    // Calculate streaks (consecutive days based on dailyBreakdown)
    let currentStreak = 0;
    let longestStreak = 0;
    const dateKeys = Object.keys(dailyBreakdown).sort();
    if (dateKeys.length) {
      const firstDate = new Date(dateKeys[0]);
      const lastDate = new Date(dateKeys[dateKeys.length - 1]);
      const allDates = [];

      for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().split("T")[0]);
      }

      let streak = 0;
      allDates.forEach((date) => {
        const count = dailyBreakdown[date] || 0;
        if (count > 0) {
          streak++;
          if (streak > longestStreak) longestStreak = streak;
        } else {
          streak = 0;
        }
      });
      currentStreak = streak;
    }

    // Random word
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];

    // Calculate days collecting
    const daysCollecting = sortedWords.length > 0 ? Math.floor(
      (sortedWords[sortedWords.length - 1].date - sortedWords[0].date) / (1000 * 60 * 60 * 24)
    ) : 0;

    // Count distinct words and find most repeated
    const wordFrequency = {};
    allWords.forEach((wordData) => {
      const wordLower = wordData.word.toLowerCase();
      wordFrequency[wordLower] = (wordFrequency[wordLower] || 0) + 1;
    });

    const distinctWords = Object.keys(wordFrequency).length;
    const repeatedWords = Object.entries(wordFrequency)
      .filter(([_, count]) => count > 1)
      .map(([word, count]) => {
        // Find the original word entry with proper casing
        const originalEntry = allWords.find(
          (w) => w.word.toLowerCase() === word
        );
        return {
          word: originalEntry?.word || word,
          count,
          definition: originalEntry?.definition,
          source: originalEntry?.source,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Build words by source
    const wordsBySource = {};
    allWords.forEach((wordData) => {
      const source = wordData.source || 'Unknown';
      if (!wordsBySource[source]) {
        wordsBySource[source] = [];
      }
      wordsBySource[source].push(wordData);
    });

    // Get all sources sorted by count
    const allSources = Object.entries(wordsBySource)
      .map(([name, words]) => ({ name, count: words.length }))
      .sort((a, b) => b.count - a.count);

    // Load Spanish words count from JSON
    let spanishWordCount = 0;
    try {
      const fs = require('fs');
      const path = require('path');
      const spanishWordsFile = path.join(__dirname, 'spanish_words_found.json');
      if (fs.existsSync(spanishWordsFile)) {
        const spanishWordsData = JSON.parse(fs.readFileSync(spanishWordsFile, 'utf-8'));
        spanishWordCount = spanishWordsData.length;
      }
    } catch (e) {
      console.warn('Could not load Spanish words count:', e.message);
    }

    return {
      totalWords: allWords.length,
      distinctWords,
      totalCurations: collection.length,
      averageWordsPerCuration: allWords.length / collection.length,
      daysCollecting,
      yearlyBreakdown,
      maxYearlyCount,
      topMonths,
      topSources,
      allSources,
      letterDistribution,
      maxLetterCount,
      firstWord,
      latestWord,
      currentStreak,
      longestStreak,
      randomWord,
      repeatedWords,
      wordsBySource,
      dailyBreakdown,
      spanishWordCount,
    };
  });

  // Add collections for recent items
  eleventyConfig.addCollection("recentWordCurations", function(collectionApi) {
    return collectionApi.getFilteredByTag("word_curation")
      .sort((a, b) => b.data.date - a.data.date)
      .slice(0, 1);
  });

  eleventyConfig.addCollection("recentPens", function(collectionApi) {
    return collectionApi.getFilteredByTag("pen")
      .sort((a, b) => b.data.date - a.data.date)
      .slice(0, 6);
  });

  return {
    dir: {
      input: "src",
      output: "public",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};
