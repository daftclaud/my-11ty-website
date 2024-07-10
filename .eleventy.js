const util = require('util');

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("./src/style.css");

  eleventyConfig.addFilter('console', function(value) {
    return util.inspect(value);
});

  return {
    dir: {
      input: "src",
      output: "public",
    },
  };
};
