const util = require("util");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("./src/style.css");

  eleventyConfig.addFilter("console", function (value) {
    return util.inspect(value);
  });

  eleventyConfig.addFilter("formatDate", function (date, locale = "en-US") {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date(date).toLocaleDateString(locale, options);
  });

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
