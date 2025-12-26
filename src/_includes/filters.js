const markdownIt = require('markdown-it');
const md = markdownIt({ html: true, breaks: true, linkify: true });

module.exports = function(eleventyConfig) {
  eleventyConfig.addNunjucksFilter("getCategory", function(source, sourceCategories, fallback = 'Uncategorized') {
    if (!source || !sourceCategories) return '';
    return sourceCategories[source] || fallback;
  });

  eleventyConfig.addNunjucksFilter("slugify", function(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  });

  // Render inline markdown content (used for translated pen bodies)
  eleventyConfig.addFilter("md", function(content) {
    if (!content) return '';
    return md.render(content);
  });
};
