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

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
