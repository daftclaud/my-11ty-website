class WordCurationsIndex {
  data() {
    return {
      layout: false,
      permalink: "word-curations/index.json",
      eleventyComputed: {
        indexData: (data) => {
          const list = data.collections?.word_curation || [];
          const dates = list
            .map((c) => c.data.date)
            .filter(Boolean)
            .sort((a, b) => a.getTime() - b.getTime())
            .map((d) => d.toISOString().slice(0, 10));

          const years = Array.from(
            new Set(
              list
                .map((c) => c.data.date)
                .filter(Boolean)
                .map((d) => d.getFullYear())
            )
          ).sort((a, b) => a - b);

          return {
            totalCurations: dates.length,
            years,
            dates,
            latestDate: dates[dates.length - 1] || null,
          };
        },
      },
    };
  }

  render({ indexData }) {
    return JSON.stringify(indexData, null, 2);
  }
}

module.exports = WordCurationsIndex;
