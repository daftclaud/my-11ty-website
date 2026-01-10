class WordCurationsByYear {
  data() {
    return {
      layout: false,
      eleventyExcludeFromCollections: true,
      permalink: (data) => {
        const [year] = data.pagination.items[0] || [];
        if (!year) return false;
        return `word-curations/${year}.json`;
      },
      pagination: {
        data: "collections.word_curation",
        size: 1,
        before: function(paginationData) {
          // Group curations by year
          const grouped = {};
          paginationData.forEach((curation) => {
            const date = curation.data.date;
            if (!date) return;
            const year = date.getFullYear();
            if (!grouped[year]) grouped[year] = [];
            grouped[year].push(curation);
          });

          // Convert to array of [year, curations]
          return Object.entries(grouped)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([year, curations]) => [
              Number(year),
              curations
                .sort((a, b) => a.data.date.getTime() - b.data.date.getTime())
                .map((item) => ({
                  date: item.data.date.toISOString().slice(0, 10),
                  words: item.data.words || [],
                }))
            ]);
        }
      }
    };
  }

  render(data) {
    const [year, curations] = data.pagination.items[0] || [];
    
    return JSON.stringify({
      year: year,
      curations: curations || []
    }, null, 2);
  }
}

module.exports = WordCurationsByYear;
