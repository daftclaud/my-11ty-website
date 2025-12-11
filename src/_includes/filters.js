module.exports = function(eleventyConfig) {
  eleventyConfig.addNunjucksFilter("getCategory", function(source, sourceCategories) {
    if (!source || !sourceCategories) return '';
    return sourceCategories[source] || 'Uncategorized';
  });

  eleventyConfig.addNunjucksFilter("slugify", function(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  });
};
