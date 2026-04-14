const wordCategoriesPage = require('./wordCategoriesPage');
const bookCovers = require('./bookCovers.json');
const bookMeta = require('./bookMeta.json');

function parseSource(source) {
  const clean = (source || '').trim();
  const chunks = clean.split(' - ').map((part) => part.trim()).filter(Boolean);

  if (chunks.length >= 2) {
    const title = chunks[0];
    const tail = chunks.slice(1).join(' - ');
    const author = tail.replace(/^(novel|book)?\s*by\s+/i, '').trim();
    return { title, author };
  }

  return { title: clean, author: '' };
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function estimateYear(firstSeen, lastSeen) {
  const start = parseDate(firstSeen);
  const end = parseDate(lastSeen);

  if (start && end) {
    const midpoint = new Date(Math.floor((start.getTime() + end.getTime()) / 2));
    return midpoint.getUTCFullYear();
  }

  if (start) return start.getUTCFullYear();
  if (end) return end.getUTCFullYear();
  return null;
}

function buildFallbackInfoUrl(title, author) {
  const q = `${title || ''} ${author || ''} book`;
  return `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
}

module.exports = function () {
  const data = wordCategoriesPage();
  const booksBucket = (data.sourcesByCategory && data.sourcesByCategory['Books/Novels']) || {};

  const books = Object.entries(booksBucket).map(([source, entries]) => {
    const { title, author } = parseSource(source);
    const dates = entries
      .map((entry) => entry.date)
      .filter(Boolean)
      .sort();

    const meta = bookMeta[source] || {};

    return {
      source,
      title,
      author,
      coverPath: (bookCovers[source] && bookCovers[source].coverPath) || null,
      infoUrl: (bookCovers[source] && bookCovers[source].infoUrl) || buildFallbackInfoUrl(title, author),
      genres: meta.genres || [],
      publishedYear: meta.publishedYear || null,
      blurbEn: meta.blurbEn || '',
      blurbEs: meta.blurbEs || '',
      wordsCount: entries.length,
      firstSeen: dates[0] || null,
      lastSeen: dates[dates.length - 1] || null,
      estimatedYear: estimateYear(dates[0] || null, dates[dates.length - 1] || null),
    };
  }).sort((a, b) => {
    if (a.lastSeen && b.lastSeen) {
      return a.lastSeen < b.lastSeen ? 1 : -1;
    }
    return a.title.localeCompare(b.title);
  });

  const grouped = {};

  books.forEach((book) => {
    const year = book.estimatedYear;
    if (!year) return;
    if (!grouped[year]) {
      grouped[year] = [];
    }
    grouped[year].push(book);
  });

  const booksByYear = Object.entries(grouped)
    .map(([yearStr, items]) => {
      const sortedItems = items.slice().sort((a, b) => {
        if (a.firstSeen && b.firstSeen && a.firstSeen !== b.firstSeen) {
          return a.firstSeen.localeCompare(b.firstSeen);
        }
        if (a.lastSeen && b.lastSeen && a.lastSeen !== b.lastSeen) {
          return a.lastSeen.localeCompare(b.lastSeen);
        }
        return a.title.localeCompare(b.title);
      });

      const withOrder = sortedItems.map((book, index) => ({
        ...book,
        estimatedOrder: index + 1,
      }));

      return {
        year: Number(yearStr),
        totalBooks: withOrder.length,
        totalWords: withOrder.reduce((acc, book) => acc + (book.wordsCount || 0), 0),
        books: withOrder,
      };
    })
    .sort((a, b) => b.year - a.year);

  return {
    totalBooks: books.length,
    books,
    booksByYear,
  };
};
