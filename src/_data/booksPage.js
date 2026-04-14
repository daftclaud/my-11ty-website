const wordCategoriesPage = require('./wordCategoriesPage');
const bookCovers = require('./bookCovers.json');

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

module.exports = function () {
  const data = wordCategoriesPage();
  const booksBucket = (data.sourcesByCategory && data.sourcesByCategory['Books/Novels']) || {};

  const books = Object.entries(booksBucket).map(([source, entries]) => {
    const { title, author } = parseSource(source);
    const dates = entries
      .map((entry) => entry.date)
      .filter(Boolean)
      .sort();

    return {
      source,
      title,
      author,
      coverPath: (bookCovers[source] && bookCovers[source].coverPath) || null,
      wordsCount: entries.length,
      firstSeen: dates[0] || null,
      lastSeen: dates[dates.length - 1] || null,
    };
  }).sort((a, b) => {
    if (a.lastSeen && b.lastSeen) {
      return a.lastSeen < b.lastSeen ? 1 : -1;
    }
    return a.title.localeCompare(b.title);
  });

  return {
    totalBooks: books.length,
    books,
  };
};
