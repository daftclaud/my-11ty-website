const util = require("util");
const MyComponent = require("./src/_includes/calendar.11ty.js");

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

  eleventyConfig.addFilter(
    "getPreviousCuration",
    function (collection, date) {
      const currentIndex = collection.findIndex(
        (curation) => curation.date === date
      );
      if (currentIndex > 0) {
        return collection[currentIndex - 1];
      }
      return null;
    }
  );

  eleventyConfig.addFilter(
    "getNextCuration",
    function (collection, date) {
      const currentIndex = collection.findIndex(
        (curation) => curation.date === date
      );
      if (currentIndex < collection.length - 1) {
        return collection[currentIndex + 1];
      }
      return null;
    }
  );

  eleventyConfig.addShortcode("calendar", function(data) {
    const component = new MyComponent();
    return component.render(data);
  });
  

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
