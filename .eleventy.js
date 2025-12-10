const util = require("util");
const Month = require("./src/_includes/month.11ty.js");
const CalendarGrid = require("./src/_includes/calendarGrid.11ty.js");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("./src/style.css");
  eleventyConfig.addPassthroughCopy("./src/assets");

  eleventyConfig.addFilter("console", function (value) {
    return util.inspect(value);
  });

  eleventyConfig.addFilter("formatDate", function (date, locale = "en-US") {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };

    // Calculate offset in milliseconds
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;

    // Create a new Date object adjusted for offset
    const adjustedDate = new Date(date.getTime() + offsetMs);

    return adjustedDate.toLocaleDateString(locale, options);
  });

  eleventyConfig.addFilter("getPreviousCuration", function (collection, date) {
    const currentIndex = collection.findIndex(
      (curation) => curation.date === date
    );
    if (currentIndex > 0) {
      return collection[currentIndex - 1];
    }
    return null;
  });

  eleventyConfig.addFilter("getNextCuration", function (collection, date) {
    const currentIndex = collection.findIndex(
      (curation) => curation.date === date
    );
    if (currentIndex < collection.length - 1) {
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

    // Calculate current streak (last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCurations = collection.filter(
      (c) => c.data.date >= thirtyDaysAgo
    );
    const currentStreak = recentCurations.length;

    // Random word
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];

    // Calculate days collecting
    const firstDate = collection[0].data.date;
    const lastDate = collection[collection.length - 1].data.date;
    const daysCollecting = Math.floor(
      (lastDate - firstDate) / (1000 * 60 * 60 * 24)
    );

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
      letterDistribution,
      maxLetterCount,
      firstWord,
      latestWord,
      currentStreak,
      randomWord,
      repeatedWords,
    };
  });

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
