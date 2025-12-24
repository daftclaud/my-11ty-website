module.exports = function(eleventyConfig) {
  eleventyConfig.addNunjucksFilter("getCategory", function(source, sourceCategories, fallback = 'Uncategorized') {
    if (!source || !sourceCategories) return '';
    return sourceCategories[source] || fallback;
  });

  eleventyConfig.addNunjucksFilter("slugify", function(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  });
};
