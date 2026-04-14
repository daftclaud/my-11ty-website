const fs = require('fs');
const path = require('path');

const booksPage = require('./src/_data/booksPage');

const coversDir = path.join(__dirname, 'src', 'assets', 'book-covers');
const manifestPath = path.join(__dirname, 'src', '_data', 'bookCovers.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
    } catch (err) {
      if (attempt === maxAttempts) {
        return null;
      }
    }

    await sleep(350 * attempt);
  }

  return null;
}

function mapOpenLibraryDoc(doc) {
  if (!doc) return null;

  const coverId = doc.cover_i;
  const isbn = Array.isArray(doc.isbn) && doc.isbn.length ? doc.isbn[0] : null;
  const url = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null);

  if (!url) return null;

  const key = doc.key || (doc.edition_key && doc.edition_key[0] ? `/books/${doc.edition_key[0]}` : null);

  return {
    provider: 'openlibrary',
    url,
    infoUrl: key ? `https://openlibrary.org${key}` : null,
  };
}

async function resolveOpenLibraryCover(title, author) {
  const normalizedTitle = normalizeForSearch(title);
  const normalizedAuthor = normalizeForSearch(author);

  const candidateParams = [
    (() => {
      const p = new URLSearchParams({ title: normalizedTitle, limit: '5' });
      if (normalizedAuthor) p.set('author', normalizedAuthor);
      return p;
    })(),
    new URLSearchParams({ title: normalizedTitle, limit: '5' }),
    new URLSearchParams({ q: `${normalizedTitle} ${normalizedAuthor}`.trim(), limit: '5' }),
  ];

  for (const params of candidateParams) {
    const openLibrary = await fetchJsonWithRetry(`https://openlibrary.org/search.json?${params.toString()}`);
    const docs = (openLibrary && openLibrary.docs) || [];
    for (const doc of docs) {
      const mapped = mapOpenLibraryDoc(doc);
      if (mapped) {
        return mapped;
      }
    }
  }

  return null;
}

async function resolveGoogleBooksCover(title, author) {
  const normalizedTitle = normalizeForSearch(title);
  const normalizedAuthor = normalizeForSearch(author);

  const strictQuery = [normalizedTitle ? `intitle:${normalizedTitle}` : '', normalizedAuthor ? `inauthor:${normalizedAuthor}` : '']
    .filter(Boolean)
    .join(' ');

  const queries = [strictQuery, `${normalizedTitle} ${normalizedAuthor}`.trim(), normalizedTitle].filter(Boolean);

  for (const query of queries) {
    const googleParams = new URLSearchParams({ q: query, maxResults: '5' });
    const googleBooks = await fetchJsonWithRetry(`https://www.googleapis.com/books/v1/volumes?${googleParams.toString()}`);
    const items = (googleBooks && googleBooks.items) || [];

    for (const item of items) {
      const links = item && item.volumeInfo && item.volumeInfo.imageLinks;
      const thumbnail = links && (links.thumbnail || links.smallThumbnail);
      if (!thumbnail) continue;

      return {
        provider: 'google-books',
        url: thumbnail.replace('http://', 'https://'),
        infoUrl: (item.volumeInfo && item.volumeInfo.infoLink) || null,
      };
    }
  }

  return null;
}

async function resolveCoverUrl(title, author) {
  const openLibrary = await resolveOpenLibraryCover(title, author);
  if (openLibrary) return openLibrary;

  const googleBooks = await resolveGoogleBooksCover(title, author);
  if (googleBooks) return googleBooks;

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
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function writeManifest(manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  if (typeof fetch !== 'function') {
    console.error('Global fetch is not available. Use Node.js 18+ to run this script.');
    process.exit(1);
  }

  fs.mkdirSync(coversDir, { recursive: true });

  const manifest = readManifest();
  const booksData = booksPage();
  const books = booksData.books || [];

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (let index = 0; index < books.length; index += 1) {
    const book = books[index];
    console.log(`[${index + 1}/${books.length}] ${book.title}`);
    const existing = manifest[book.source];
    if (existing && existing.coverPath && fs.existsSync(path.join(__dirname, 'src', existing.coverPath.replace('/assets/', 'assets/')))) {
      skipped += 1;
      console.log('  skipped (already downloaded)');
      continue;
    }

    const resolved = await resolveCoverUrl(book.title, book.author);
    if (!resolved) {
      manifest[book.source] = {
        title: book.title,
        author: book.author,
        coverPath: null,
        infoUrl: null,
        status: 'missing',
        checkedAt: new Date().toISOString(),
      };
      missing += 1;
      console.log('  missing (no provider result)');
      writeManifest(manifest);
      await sleep(120);
      continue;
    }

    const baseName = `${slugify(book.title)}-${slugify(book.author || 'na')}`;
    const coverPath = await downloadCover(resolved.url, baseName);

    if (!coverPath) {
      manifest[book.source] = {
        title: book.title,
        author: book.author,
        coverPath: null,
        infoUrl: null,
        status: 'missing',
        checkedAt: new Date().toISOString(),
      };
      missing += 1;
      console.log('  missing (download failed)');
      writeManifest(manifest);
      await sleep(120);
      continue;
    }

    manifest[book.source] = {
      title: book.title,
      author: book.author,
      coverPath,
      infoUrl: resolved.infoUrl || null,
      provider: resolved.provider,
      status: 'ok',
      checkedAt: new Date().toISOString(),
    };

    created += 1;
    writeManifest(manifest);
    console.log(`  saved (${resolved.provider})`);
    await sleep(120);
  }

  writeManifest(manifest);

  console.log(`Book cover sync complete. created=${created}, skipped=${skipped}, missing=${missing}`);
}

main().catch((err) => {
  console.error('Failed to fetch book covers:', err);
  process.exit(1);
});
