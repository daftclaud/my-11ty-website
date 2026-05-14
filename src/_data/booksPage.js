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

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'over', 'under', 'after', 'before',
  'his', 'her', 'their', 'its', 'that', 'this', 'those', 'these', 'years', 'year', 'book',
  'novel', 'story', 'stories', 'world', 'end', 'beginning', 'part', 'edition',
]);

function getMatchScore(candidateKey, title, author) {
  const candidateNorm = normalizeText(candidateKey);
  const titleNorm = normalizeText(title);
  const authorNorm = normalizeText(author);

  if (!titleNorm) return 0;

  let score = 0;
  if (candidateNorm.includes(titleNorm)) score += 10;

  const titleTokens = titleNorm
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  let matchedTitleTokens = 0;
  titleTokens.forEach((token) => {
    if (candidateNorm.includes(token)) {
      score += 1;
      matchedTitleTokens += 1;
    }
  });

  if (authorNorm) {
    const authorTokens = authorNorm.split(' ').filter((token) => token.length > 2);
    authorTokens.forEach((token) => {
      if (candidateNorm.includes(token)) score += 2;
    });
  }

  return { score, hasTitleMatch: candidateNorm.includes(titleNorm) || matchedTitleTokens > 0 };
}

function resolveDataKey(sourceMap, title, author) {
  const exactKey = `${title} - ${author || ''}`.trim();
  if (sourceMap && Object.prototype.hasOwnProperty.call(sourceMap, exactKey)) {
    return exactKey;
  }

  const titleOnlyKey = `${title}`.trim();
  if (sourceMap && Object.prototype.hasOwnProperty.call(sourceMap, titleOnlyKey)) {
    return titleOnlyKey;
  }

  return findBestData(sourceMap, title, author);
}

function findBestData(sourceMap, title, author) {
  let bestKey = null;
  let bestScore = 0;
  let bestHasTitleMatch = false;

  Object.keys(sourceMap || {}).forEach((key) => {
    const { score, hasTitleMatch } = getMatchScore(key, title, author);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
      bestHasTitleMatch = hasTitleMatch;
    }
  });

  if (bestScore < 6 || !bestHasTitleMatch) return null;
  return bestKey;
}

const curatedBooksByYear = [
  {
    year: 2026,
    books: [
      { title: 'El Gigante Enterrado', author: 'Kazuo Ishiguro' },
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
    year: 2023,
    books: [
      { title: 'Flowers for Algernon', author: 'Daniel Keyes' },
      { title: 'The Idiot', author: 'Fyodor Dostoevsky' },
      { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' },
      { title: 'The Death of Ivan Ilyich', author: 'Leo Tolstoy' },
      { title: 'Cloud Atlas', author: 'David Mitchell' },
      { title: 'Good Strategy Bad Strategy: The Difference and Why It Matters', author: 'Richard P. Rumelt' },
      { title: 'Leonardo da Vinci', author: 'Walter Isaacson' },
      { title: 'When We Cease to Understand the World (Un verdor terrible)', author: 'Benjamin Labatut' },
      { title: 'The Three-Body Problem', author: 'Liu Cixin' },
      { title: 'The Dark Forest', author: 'Liu Cixin' },
      { title: 'East of Eden', author: 'John Steinbeck' },
      { title: 'Norwegian Wood', author: 'Haruki Murakami' },
      { title: 'Colorless Tsukuru Tazaki and His Years of Pilgrimage', author: 'Haruki Murakami' },
      { title: '1Q84', author: 'Haruki Murakami' },
      { title: 'Kafka on the Shore', author: 'Haruki Murakami' },
      { title: 'After Dark', author: 'Haruki Murakami' },
      { title: 'After the Quake', author: 'Haruki Murakami' },
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
    title: 'Los Hermanos Karamazov',
    author: 'Fyodor Dostoevsky',
  },
];

module.exports = function () {
  const enrichBook = (book, order, year) => {
    const coverKey = resolveDataKey(bookCovers, book.title, book.author);
    const metaKey = resolveDataKey(bookMeta, book.title, book.author);
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
