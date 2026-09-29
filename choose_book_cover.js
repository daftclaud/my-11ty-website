const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

const booksPage = require('./src/_data/booksPage');

const coversDir = path.join(__dirname, 'src', 'assets', 'book-covers');
const manifestPath = path.join(__dirname, 'src', '_data', 'bookCovers.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeForSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchJsonWithRetry(url, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);
      if (response.ok) {
        return response.json();
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        return null;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        return null;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
  }

  return null;
}

function getExtension(contentType, url) {
  if (contentType && contentType.includes('png')) return '.png';
  if (contentType && contentType.includes('webp')) return '.webp';

  const cleanUrl = String(url || '').toLowerCase();
  if (cleanUrl.includes('.png')) return '.png';
  if (cleanUrl.includes('.webp')) return '.webp';

  return '.jpg';
}

async function downloadCover(url, filenameBase) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const ext = getExtension(contentType, url);
  const bytes = await response.arrayBuffer();
  const fileName = `${filenameBase}${ext}`;
  const absolutePath = path.join(coversDir, fileName);

  fs.writeFileSync(absolutePath, Buffer.from(bytes));

  return `/assets/book-covers/${fileName}`;
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    return {};
  }
}

function writeManifest(manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function resolveOpenLibraryCandidates(title, author) {
  const normalizedTitle = normalizeForSearch(title);
  const normalizedAuthor = normalizeForSearch(author);

  const params = new URLSearchParams({ title: normalizedTitle, limit: '10' });
  if (normalizedAuthor) params.set('author', normalizedAuthor);

  const search = await fetchJsonWithRetry(`https://openlibrary.org/search.json?${params.toString()}`);
  const docs = (search && search.docs) || [];
  const candidates = [];

  docs.forEach((doc, index) => {
    const coverId = doc.cover_i;
    const isbn = Array.isArray(doc.isbn) && doc.isbn.length ? doc.isbn[0] : null;
    const url = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null);

    if (!url) return;

    candidates.push({
      provider: 'openlibrary',
      url,
      infoUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
      label: doc.edition_key && doc.edition_key[0] ? doc.edition_key[0] : `Open Library result ${index + 1}`,
    });
  });

  return candidates;
}

async function resolveGoogleBooksCandidates(title, author) {
  const normalizedTitle = normalizeForSearch(title);
  const normalizedAuthor = normalizeForSearch(author);

  const strictQuery = [normalizedTitle ? `intitle:${normalizedTitle}` : '', normalizedAuthor ? `inauthor:${normalizedAuthor}` : '']
    .filter(Boolean)
    .join(' ');
  const queries = [strictQuery, `${normalizedTitle} ${normalizedAuthor}`.trim(), normalizedTitle].filter(Boolean);

  const candidates = [];
  for (const query of queries) {
    const googleParams = new URLSearchParams({ q: query, maxResults: '10' });
    const googleBooks = await fetchJsonWithRetry(`https://www.googleapis.com/books/v1/volumes?${googleParams.toString()}`);
    const items = (googleBooks && googleBooks.items) || [];

    items.forEach((item, index) => {
      const links = item && item.volumeInfo && item.volumeInfo.imageLinks;
      const thumbnail = links && (links.thumbnail || links.smallThumbnail);
      if (!thumbnail) return;

      candidates.push({
        provider: 'google-books',
        url: thumbnail.replace('http://', 'https://'),
        infoUrl: (item.volumeInfo && item.volumeInfo.infoLink) || null,
        label: (item.volumeInfo && item.volumeInfo.title) || `Google Books result ${index + 1}`,
      });
    });
  }

  return candidates;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.provider}:${candidate.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatBookLabel(book) {
  return `${book.title} - ${book.author || '(no author)'}`;
}

function parseSelectionInput(input, max) {
  const tokens = String(input || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const indexes = new Set();

  tokens.forEach((token) => {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (Number.isNaN(start) || Number.isNaN(end)) return;
      const low = Math.min(start, end);
      const high = Math.max(start, end);
      for (let index = low; index <= high; index += 1) {
        if (index >= 1 && index <= max) indexes.add(index - 1);
      }
      return;
    }

    const numeric = Number(token);
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= max) {
      indexes.add(numeric - 1);
    }
  });

  return [...indexes].sort((a, b) => a - b);
}

async function prompt(text) {
  return rl.question(text);
}

async function selectBooks(books) {
  if (!books.length) {
    return [];
  }

  while (true) {
    const searchTerm = String(await prompt('\nSearch books (leave blank to show all): ')).trim();
    const normalizedSearch = normalizeForSearch(searchTerm);
    const matches = normalizedSearch
      ? books.filter((book) => {
          const titleMatch = normalizeForSearch(book.title).includes(normalizedSearch);
          const authorMatch = normalizeForSearch(book.author).includes(normalizedSearch);
          return titleMatch || authorMatch;
        })
      : books.slice();

    if (!matches.length) {
      console.log('No matches. Try another search term.');
      continue;
    }

    console.log('\nSelect one or more books by number. Examples: `1`, `1,3,5`, `2-4`');
    matches.forEach((book, index) => {
      console.log(`${index + 1}. ${formatBookLabel(book)}`);
    });

    const selectionInput = await prompt('\nBooks: ');
    const selectedIndexes = parseSelectionInput(selectionInput, matches.length);
    if (!selectedIndexes.length) {
      console.log('No valid selection. Try again.');
      continue;
    }

    return selectedIndexes.map((index) => matches[index]);
  }
}

async function selectCandidate(candidates, book) {
  console.log(`\nCover candidates for ${formatBookLabel(book)}`);
  candidates.forEach((candidate, index) => {
    console.log(`${index + 1}. [${candidate.provider}] ${candidate.label}`);
    console.log(`   ${candidate.url}`);
  });

  while (true) {
    const choice = Number(await prompt('\nChoose cover number: '));
    const selectedCandidate = candidates[choice - 1];
    if (selectedCandidate) {
      return selectedCandidate;
    }

    console.log('Invalid cover selection. Try again.');
  }
}

function resolveBookCandidates(book, manifest) {
  const existing = manifest[book.source];
  return Promise.all([
    resolveOpenLibraryCandidates(book.title, book.author),
    resolveGoogleBooksCandidates(book.title, book.author),
  ]).then(([openLibraryCandidates, googleBooksCandidates]) => ({
    existing,
    candidates: dedupeCandidates([...openLibraryCandidates, ...googleBooksCandidates]),
  }));
}

async function saveSelectedCover(manifest, book, candidate) {
  fs.mkdirSync(coversDir, { recursive: true });
  const fileBase = `${slugify(book.title)}-${slugify(book.author || 'na')}`;
  const coverPath = await downloadCover(candidate.url, fileBase);
  if (!coverPath) {
    throw new Error('Cover download failed.');
  }

  manifest[book.source] = {
    title: book.title,
    author: book.author,
    coverPath,
    infoUrl: candidate.infoUrl || null,
    provider: candidate.provider,
    status: 'ok',
    checkedAt: new Date().toISOString(),
  };
  writeManifest(manifest);

  return coverPath;
}

async function pickBook() {
  const args = process.argv.slice(2).filter((value) => value !== '--');
  const titleArg = args[0] || '';
  const authorArg = args[1] || '';

  const allBooks = booksPage();
  const books = [...(allBooks.books || []), ...(allBooks.currentlyReading || [])];
  const bookIndex = new Map(books.map((book) => [`${book.title}|||${book.author || ''}`, book]));

  let seededBooks = [];
  if (titleArg) {
    const exactMatch = bookIndex.get(`${titleArg}|||${authorArg || ''}`) || null;
    if (exactMatch) {
      seededBooks = [exactMatch];
    } else {
      seededBooks = books.filter((book) => {
        const titleMatch = normalizeForSearch(book.title).includes(normalizeForSearch(titleArg));
        const authorMatch = !authorArg || normalizeForSearch(book.author).includes(normalizeForSearch(authorArg));
        return titleMatch && authorMatch;
      });
    }
  }

  if (!seededBooks.length) {
    seededBooks = await selectBooks(books);
  }

  const manifest = readManifest();

  for (const book of seededBooks) {
    const { existing, candidates } = await resolveBookCandidates(book, manifest);

    if (existing && existing.coverPath) {
      console.log(`\nCurrent cover for ${formatBookLabel(book)}:`);
      console.log(`   ${existing.coverPath}`);
      const replace = String(await prompt('Replace it? (y/n): ')).trim().toLowerCase();
      if (replace !== 'y' && replace !== 'yes') {
        console.log('Keeping existing cover.');
        continue;
      }
    }

    if (!candidates.length) {
      console.log(`\nNo cover candidates found for ${formatBookLabel(book)}.`);
      continue;
    }

    const selectedCandidate = await selectCandidate(candidates, book);
    await saveSelectedCover(manifest, book, selectedCandidate);
    console.log(`\nSaved ${book.title} using ${selectedCandidate.provider}.`);
  }

  while (true) {
    const again = String(await prompt('\nChoose another book? (y/n): ')).trim().toLowerCase();
    if (again !== 'y' && again !== 'yes') {
      break;
    }

    const moreBooks = await selectBooks(books);
    for (const book of moreBooks) {
      const { existing, candidates } = await resolveBookCandidates(book, manifest);

      if (existing && existing.coverPath) {
        console.log(`\nCurrent cover for ${formatBookLabel(book)}:`);
        console.log(`   ${existing.coverPath}`);
        const replace = String(await prompt('Replace it? (y/n): ')).trim().toLowerCase();
        if (replace !== 'y' && replace !== 'yes') {
          console.log('Keeping existing cover.');
          continue;
        }
      }

      if (!candidates.length) {
        console.log(`\nNo cover candidates found for ${formatBookLabel(book)}.`);
        continue;
      }

      const selectedCandidate = await selectCandidate(candidates, book);
      await saveSelectedCover(manifest, book, selectedCandidate);
      console.log(`\nSaved ${book.title} using ${selectedCandidate.provider}.`);
    }
  }

  rl.close();
}

pickBook().catch((error) => {
  try {
    rl.close();
  } catch (closeError) {
    // ignore close errors
  }
  console.error(error.message || error);
  process.exit(1);
});