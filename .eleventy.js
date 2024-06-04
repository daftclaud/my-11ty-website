module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("./src/style.css");
  eleventyConfig.addPassthroughCopy("./src/assets");

  eleventyConfig.addFilter("getDate", function (dateStr) {
    return new Date(dateStr);
  });

  eleventyConfig.addFilter("formatDate", function (dateObj) {
    return dateObj.toLocaleDateString("en-us", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  eleventyConfig.addFilter("getPreviousDay", function (dateObj) {
    const previousDay = new Date(dateObj); // Create a copy of the original date
    previousDay.setDate(dateObj.getDate() - 1); // Subtract 1 day
    return previousDay;
  });

  eleventyConfig.addFilter("getNextDay", function (dateObj) {
    const previousDay = new Date(dateObj); // Create a copy of the original date
    previousDay.setDate(dateObj.getDate() + 1); // Add 1 day
    return previousDay;
  });

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
