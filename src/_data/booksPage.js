const bookCovers = require('./bookCovers.json');
const bookMeta = require('./bookMeta.json');

function buildFallbackInfoUrl(title, author) {
  const q = `${title || ''} ${author || ''} book`;
  return `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMatchScore(candidateKey, title, author) {
  const candidateNorm = normalizeText(candidateKey);
  const titleNorm = normalizeText(title);
  const authorNorm = normalizeText(author);

  if (!titleNorm) return 0;

  let score = 0;
  if (candidateNorm.includes(titleNorm)) score += 10;

  const titleTokens = titleNorm.split(' ').filter((token) => token.length > 2);
  titleTokens.forEach((token) => {
    if (candidateNorm.includes(token)) score += 1;
  });

  if (authorNorm) {
    const authorTokens = authorNorm.split(' ').filter((token) => token.length > 2);
    authorTokens.forEach((token) => {
      if (candidateNorm.includes(token)) score += 2;
    });
  }

  return score;
}

function findBestData(sourceMap, title, author) {
  let bestKey = null;
  let bestScore = 0;

  Object.keys(sourceMap || {}).forEach((key) => {
    const score = getMatchScore(key, title, author);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  if (bestScore < 5) return null;
  return bestKey;
}

const curatedBooksByYear = [
  {
    year: 2026,
    books: [
      { title: 'Foundation', author: 'Isaac Asimov' },
      { title: 'Freakonomics', author: 'Steven D. Levitt and Stephen J. Dubner' },
      { title: 'The Undoing Project', author: 'Michael Lewis' },
      { title: 'Project Hail Mary', author: 'Andy Weir' },
    ],
  },
  {
    year: 2025,
    books: [
      { title: 'El juego del angel', author: 'Carlos Ruiz Zafon' },
      { title: 'Benjamin Franklin: An American Life', author: 'Walter Isaacson' },
      { title: 'The Language Instinct', author: 'Steven Pinker' },
      { title: 'A Wild Sheep Chase', author: 'Haruki Murakami' },
      { title: 'The Singularity Is Near', author: 'Ray Kurzweil' },
      { title: 'Harry Potter and the Goblet of Fire', author: 'J.K. Rowling' },
      { title: 'Harry Potter and the Order of the Phoenix', author: 'J.K. Rowling' },
      { title: 'Harry Potter and the Half-Blood Prince', author: 'J.K. Rowling' },
      { title: 'Around the World in Eighty Days', author: 'Jules Verne' },
      { title: 'Zen and the Art of Motorcycle Maintenance', author: 'Robert M. Pirsig' },
      { title: 'The Catcher in the Rye', author: 'J.D. Salinger' },
      { title: "Sophie's World", author: 'Jostein Gaarder' },
      { title: 'The Wind-Up Bird Chronicle', author: 'Haruki Murakami' },
      { title: 'How High We Go in the Dark', author: 'Sequoia Nagamatsu' },
      { title: 'Not the End of the World', author: 'Hannah Ritchie' },
      { title: 'Never Let Me Go', author: 'Kazuo Ishiguro' },
      { title: 'Pachinko', author: 'Min Jin Lee' },
      { title: 'Noise', author: 'Daniel Kahneman' },
      { title: 'This Is Lean', author: 'Niklas Modig and Par Ahlstrom' },
      { title: 'The Phoenix Project', author: 'Gene Kim' },
    ],
  },
  {
    year: 2024,
    books: [
      { title: "Death's End", author: 'Cixin Liu' },
      { title: "Harry Potter and the Philosopher's Stone", author: 'J.K. Rowling' },
      { title: 'Maniac', author: 'Benjamin Labatut' },
      { title: 'Harry Potter and the Chamber of Secrets', author: 'J.K. Rowling' },
      { title: 'Zero to One', author: 'Peter Thiel' },
      { title: 'Hypermedia Systems', author: 'Carson Gross' },
      { title: 'Harry Potter and the Prisoner of Azkaban', author: 'J.K. Rowling' },
      { title: 'Snow Crash', author: 'Neal Stephenson' },
      { title: 'Anna Karenina', author: 'Leo Tolstoy' },
      { title: 'Children of Time', author: 'Adrian Tchaikovsky' },
      { title: 'Children of Ruin', author: 'Adrian Tchaikovsky' },
      { title: 'Children of Memory', author: 'Adrian Tchaikovsky' },
      { title: 'The Physician', author: 'Noah Gordon' },
      { title: 'The Road', author: 'Cormac McCarthy' },
      { title: 'Nexus', author: 'Yuval Noah Harari' },
      { title: 'Hard-Boiled Wonderland and the End of the World', author: 'Haruki Murakami' },
      { title: 'Stories of Your Life and Others', author: 'Ted Chiang' },
    ],
  },
  {
    year: 2020,
    books: [
      { title: 'Atlas Shrugged', author: 'Ayn Rand' },
      { title: 'Sapiens', author: 'Yuval Noah Harari' },
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Nudge', author: 'Richard H. Thaler & Cass R. Sunstein' },
      { title: 'Dune Messiah', author: 'Frank Herbert' },
      { title: 'The Design of Everyday Things', author: 'Don Norman' },
    ],
  },
  {
    year: 2019,
    books: [
      { title: 'The Fountainhead', author: 'Ayn Rand' },
      { title: 'Steve Jobs', author: 'Walter Isaacson' },
      { title: 'Brave New World', author: 'Aldous Huxley' },
      { title: 'The Coddling of the American Mind', author: 'Greg Lukianoff & Jonathan Haidt' },
      { title: 'Lord of the Flies', author: 'William Golding' },
      { title: 'All Minus One', author: 'John Stuart Mill, Edited by Richard V. Reeves & Jonathan Haidt' },
      { title: 'To Kill A Mockingbird', author: 'Harper Lee' },
      { title: 'Zen and the Art of Motorcycle Maintenance', author: 'Robert M. Pirsig' },
      { title: 'The Righteous Mind', author: 'Jonathan Haidt' },
      { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman' },
      { title: '11/22/63', author: 'Stephen King' },
      { title: '21 Lessons for the 21st Century', author: 'Yuval Noah Harari' },
    ],
  },
];

const currentlyReading = [
  {
    title: 'El Gigante Enterrado',
    author: 'Kazuo Ishiguro',
  },
];

module.exports = function () {
  const enrichBook = (book, order, year) => {
    const coverKey = findBestData(bookCovers, book.title, book.author);
    const metaKey = findBestData(bookMeta, book.title, book.author);
    const cover = coverKey ? bookCovers[coverKey] : null;
    const meta = metaKey ? bookMeta[metaKey] : null;

    return {
      ...book,
      source: coverKey || metaKey || `${book.title} - ${book.author || ''}`,
      coverPath: (cover && cover.coverPath) || null,
      infoUrl: (cover && cover.infoUrl) || buildFallbackInfoUrl(book.title, book.author),
      genres: (meta && meta.genres) || [],
      publishedYear: (meta && meta.publishedYear) || null,
      blurbEn: (meta && meta.blurbEn) || '',
      blurbEs: (meta && meta.blurbEs) || '',
      year,
      estimatedOrder: order,
    };
  };

  const booksByYear = curatedBooksByYear.map((group) => {
    const books = group.books.map((book, index) => enrichBook(book, index + 1, group.year));
    return {
      year: group.year,
      totalBooks: books.length,
      books,
    };
  });

  const books = booksByYear.flatMap((group) => group.books);
  const currentlyReadingBooks = currentlyReading.map((book, index) => enrichBook(book, index + 1, null));

  return {
    totalBooks: books.length,
    books,
    booksByYear,
    currentlyReading: currentlyReadingBooks,
  };
};
