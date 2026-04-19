const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = {
    collection: process.env.FIRESTORE_COLLECTION || 'ReadingItems',
    rawOut: process.env.FIRESTORE_RAW_OUT || path.join('migration-output', 'firestore-readingitems-raw.json'),
    normalizedOut:
      process.env.FIRESTORE_NORMALIZED_OUT || path.join('migration-output', 'firestore-readingitems-normalized.json'),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--collection' && argv[i + 1]) {
      args.collection = argv[i + 1];
      i += 1;
    } else if (token === '--raw-out' && argv[i + 1]) {
      args.rawOut = argv[i + 1];
      i += 1;
    } else if (token === '--normalized-out' && argv[i + 1]) {
      args.normalizedOut = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function stringifyJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDate(value) {
  if (!value) return null;

  // Firestore Timestamp (admin SDK)
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'object' && value !== null && typeof value._seconds === 'number') {
    const ms = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function buildFallbackInfoUrl(title, author) {
  const q = `${title || ''} ${author || ''} book`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function pickAuthor(data) {
  const fromArray = Array.isArray(data.authors) && data.authors.length ? data.authors[0] : null;
  return data.author || fromArray || data.by || data.writer || '';
}

function pickCreatedAt(data) {
  return (
    toDate(data.creationDate) ||
    toDate(data.createdAt) ||
    toDate(data.date) ||
    toDate(data.readAt) ||
    toDate(data.finishedAt) ||
    null
  );
}

function groupByYear(items) {
  const map = new Map();

  items.forEach((item) => {
    const year = item.year || 'unknown';
    if (!map.has(year)) {
      map.set(year, []);
    }
    map.get(year).push(item);
  });

  const years = [...map.keys()].sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return Number(b) - Number(a);
  });

  return years.map((year) => ({
    year,
    total: map.get(year).length,
    items: map.get(year),
  }));
}

function buildBooksPageTemplate(items) {
  const byYear = new Map();
  const seen = new Set();

  items.forEach((item) => {
    if (!item.year || item.year === 'unknown') return;

    const dedupeKey = `${normalizeText(item.title)}|${normalizeText(item.author)}|${item.year}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    if (!byYear.has(item.year)) {
      byYear.set(item.year, []);
    }

    byYear.get(item.year).push({ title: item.title, author: item.author || '' });
  });

  return [...byYear.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, books]) => ({ year: Number(year), books }));
}

async function loadCollectionDocs(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing GOOGLE_APPLICATION_CREDENTIALS environment variable.');
    console.error('Point it to your Firebase service account JSON key.');
    process.exit(1);
  }

  const args = parseArgs(process.argv);

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  admin.initializeApp(
    projectId
      ? {
          credential: admin.credential.applicationDefault(),
          projectId,
        }
      : {
          credential: admin.credential.applicationDefault(),
        }
  );

  const db = admin.firestore();

  console.log(`Fetching Firestore collection: ${args.collection}`);
  const rawDocs = await loadCollectionDocs(db, args.collection);
  console.log(`Fetched ${rawDocs.length} documents.`);

  const normalizedItems = rawDocs
    .map((doc) => {
      const title = String(doc.title || doc.bookTitle || '').trim();
      if (!title) return null;

      const author = String(pickAuthor(doc)).trim();
      const createdAtDate = pickCreatedAt(doc);
      const createdAt = createdAtDate ? createdAtDate.toISOString() : null;
      const year = createdAtDate ? createdAtDate.getUTCFullYear() : 'unknown';

      const coverUrl = doc.coverPicUrl || doc.coverUrl || null;
      const infoUrl = doc.infoUrl || buildFallbackInfoUrl(title, author);

      return {
        sourceId: doc.id,
        title,
        author,
        createdAt,
        year,
        coverUrl,
        infoUrl,
        raw: {
          creationDate: doc.creationDate || null,
          status: doc.status || null,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return a.title.localeCompare(b.title);
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const normalized = {
    generatedAt: new Date().toISOString(),
    projectId: projectId || null,
    collection: args.collection,
    totalRaw: rawDocs.length,
    totalNormalized: normalizedItems.length,
    groupedByYear: groupByYear(normalizedItems),
    booksPageTemplate: buildBooksPageTemplate(normalizedItems),
    items: normalizedItems,
  };

  ensureParentDir(args.rawOut);
  ensureParentDir(args.normalizedOut);

  fs.writeFileSync(args.rawOut, stringifyJson(rawDocs));
  fs.writeFileSync(args.normalizedOut, stringifyJson(normalized));

  console.log(`Raw export written to: ${args.rawOut}`);
  console.log(`Normalized export written to: ${args.normalizedOut}`);
  console.log('Next step: copy normalized.booksPageTemplate into curatedBooksByYear in src/_data/booksPage.js');

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error('Migration failed:', error.message);
  try {
    if (admin.apps.length) {
      await admin.app().delete();
    }
  } catch (_) {
    // ignore cleanup errors
  }
  process.exit(1);
});
