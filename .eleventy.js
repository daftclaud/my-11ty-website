const util = require("util");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("./src/style.css");

  eleventyConfig.addFilter("console", function (value) {
    return util.inspect(value);
  });

  eleventyConfig.addFilter("formatDate", function (date, locale = "en-US") {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(date).toLocaleDateString(locale, options);
  });

  // Function to find previous curation
  eleventyConfig.addFilter(
    "getPreviousCuration",
    function (collection, currentUrl) {
      const currentIndex = collection.findIndex(
        (curation) => curation.url === currentUrl
      );
      if (currentIndex > 0) {
        return collection[currentIndex - 1];
      }
      return null; // Return null if no previous curation found
    }
  );

  // Function to find next curation
  eleventyConfig.addFilter(
    "getNextCuration",
    function (collection, currentUrl) {
      const currentIndex = collection.findIndex(
        (curation) => curation.url === currentUrl
      );
      if (currentIndex < collection.length - 1) {
        return collection[currentIndex + 1];
      }
      return null; // Return null if no next curation found
    }
  );
  

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
