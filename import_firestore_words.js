const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = {
    collection: process.env.FIRESTORE_WORDS_COLLECTION || 'words',
    rawOut: process.env.FIRESTORE_WORDS_RAW_OUT || path.join('migration-output', 'wordfeed-words-raw.json'),
    normalizedOut: process.env.FIRESTORE_WORDS_NORMALIZED_OUT || path.join('migration-output', 'wordfeed-words-normalized.json'),
    markdownOutDir:
      process.env.FIRESTORE_WORDS_MARKDOWN_OUT_DIR || path.join('migration-output', 'wordfeed-word-curations'),
    sourceLabel: process.env.FIRESTORE_WORDS_SOURCE_LABEL || 'WordFeed',
    limit: Number(process.env.FIRESTORE_WORDS_LIMIT || 0),
    sampleLimit: Number(process.env.FIRESTORE_WORDS_SAMPLE_LIMIT || 5),
    creatorName: process.env.FIRESTORE_WORDS_CREATOR_NAME || '',
    creatorUids: (process.env.FIRESTORE_WORDS_CREATOR_UIDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--collection' && next) {
      args.collection = next;
      index += 1;
    } else if (token === '--raw-out' && next) {
      args.rawOut = next;
      index += 1;
    } else if (token === '--normalized-out' && next) {
      args.normalizedOut = next;
      index += 1;
    } else if (token === '--markdown-out-dir' && next) {
      args.markdownOutDir = next;
      index += 1;
    } else if (token === '--source-label' && next) {
      args.sourceLabel = next;
      index += 1;
    } else if (token === '--limit' && next) {
      args.limit = Number(next);
      index += 1;
    } else if (token === '--sample-limit' && next) {
      args.sampleLimit = Number(next);
      index += 1;
    } else if (token === '--creator-name' && next) {
      args.creatorName = next;
      index += 1;
    } else if (token === '--creator-uids' && next) {
      args.creatorUids = next
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return args;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function toDate(value) {
  if (!value && value !== 0) return null;

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && value !== null && typeof value._seconds === 'number') {
    const ms = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function quoteYamlString(value) {
  const text = String(value ?? '');
  return JSON.stringify(text);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function pickCreatedAt(data) {
  return (
    toDate(data.dateCreated) ||
    toDate(data.createdAt) ||
    toDate(data.creationDate) ||
    null
  );
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return a.word.localeCompare(b.word);
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return a.createdAt.localeCompare(b.createdAt) || a.word.localeCompare(b.word);
  });
}

function normalizeWordDoc(doc, sourceLabel) {
  const word = cleanText(doc.word);
  const definition = cleanText(doc.definition);
  if (!word || !definition) return null;

  const createdAtDate = pickCreatedAt(doc);
  const createdAt = createdAtDate ? createdAtDate.toISOString() : null;
  const date = createdAtDate ? toIsoDate(createdAtDate) : null;
  const createdBy = doc.createdBy || {};

  return {
    sourceId: doc.id,
    word,
    definition,
    source: sourceLabel,
    createdAt,
    date,
    type: cleanText(doc.type),
    pronunciation: cleanText(doc.pronunciation),
    pronunciationUrl: cleanText(doc.pronunciationUrl),
    createdBy: {
      uid: cleanText(createdBy.uid || doc.creatorID),
      displayName: cleanText(createdBy.displayName),
      photoURL: cleanText(createdBy.photoURL),
    },
    stats: {
      likeCount: Number(doc.likeCount || 0),
      commentCount: Number(doc.commentCount || 0),
    },
    raw: {
      listIncludedIn: doc.listIncludedIn || null,
      creatorID: doc.creatorID || null,
      dateCreated: doc.dateCreated || null,
    },
  };
}

function matchesCreatorFilter(item, creatorName, creatorUids) {
  const hasNameFilter = Boolean(creatorName);
  const hasUidFilter = Array.isArray(creatorUids) && creatorUids.length > 0;

  if (!hasNameFilter && !hasUidFilter) {
    return true;
  }

  const itemName = cleanText(item.createdBy?.displayName).toLowerCase();
  const itemUid = cleanText(item.createdBy?.uid);

  if (hasUidFilter && creatorUids.includes(itemUid)) {
    return true;
  }

  if (hasNameFilter && itemName === cleanText(creatorName).toLowerCase()) {
    return true;
  }

  return false;
}

function groupWordsByDate(items) {
  const map = new Map();

  items.forEach((item) => {
    const key = item.date || 'undated';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });

  return [...map.entries()]
    .sort((a, b) => {
      if (a[0] === 'undated') return 1;
      if (b[0] === 'undated') return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([date, words]) => ({
      date,
      total: words.length,
      words: sortByCreatedAt(words),
    }));
}

function buildMarkdownContent(date, words) {
  const lines = ['---', `date: ${date}`, 'words:'];

  words.forEach((entry) => {
    lines.push(`  - word: ${quoteYamlString(entry.word)}`);
    lines.push(`    definition: ${quoteYamlString(entry.definition)}`);
    lines.push(`    source: ${quoteYamlString(entry.source)}`);
  });

  lines.push('---', '');
  return lines.join('\n');
}

async function loadCollectionDocs(db, collectionName, limit) {
  let query = db.collection(collectionName);

  try {
    query = query.orderBy('dateCreated');
  } catch (_) {
    // Fallback if orderBy fails before execution.
  }

  if (limit > 0) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing GOOGLE_APPLICATION_CREDENTIALS environment variable.');
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  admin.initializeApp(
    projectId
      ? { credential: admin.credential.applicationDefault(), projectId }
      : { credential: admin.credential.applicationDefault() }
  );

  const db = admin.firestore();

  console.log(`Using Firebase project: ${projectId || '(from service account)'}`);
  console.log(`Fetching Firestore collection: ${args.collection}`);
  const rawDocs = await loadCollectionDocs(db, args.collection, args.limit);
  console.log(`Fetched ${rawDocs.length} documents.`);

  if (rawDocs.length === 0) {
    console.warn('No documents were returned. Check that the service account and project id point to the old Wordfeed project.');
  }

  const normalizedItems = sortByCreatedAt(
    rawDocs
      .map((doc) => normalizeWordDoc(doc, args.sourceLabel))
      .filter(Boolean)
      .filter((item) => matchesCreatorFilter(item, args.creatorName, args.creatorUids))
  );

  const groupedByDate = groupWordsByDate(normalizedItems);
  const sampleItems = normalizedItems.slice(0, Math.max(0, args.sampleLimit));

  ensureDir(args.markdownOutDir);
  groupedByDate.forEach((group) => {
    if (group.date === 'undated') return;
    const filePath = path.join(args.markdownOutDir, `${group.date}.md`);
    fs.writeFileSync(filePath, buildMarkdownContent(group.date, group.words));
  });

  writeJson(args.rawOut, rawDocs);
  writeJson(args.normalizedOut, {
    generatedAt: new Date().toISOString(),
    projectId: projectId || null,
    collection: args.collection,
    totalRaw: rawDocs.length,
    totalNormalized: normalizedItems.length,
    sourceLabel: args.sourceLabel,
    creatorFilter: {
      creatorName: args.creatorName || null,
      creatorUids: args.creatorUids,
    },
    sampleItems,
    groupedByDate,
    markdownOutputDir: args.markdownOutDir,
    items: normalizedItems,
  });

  console.log(`Raw export written to: ${args.rawOut}`);
  console.log(`Normalized export written to: ${args.normalizedOut}`);
  console.log(`Markdown templates written to: ${args.markdownOutDir}`);

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error('Word migration failed:', error.message);
  try {
    if (admin.apps.length) {
      await admin.app().delete();
    }
  } catch (_) {
    // ignore cleanup errors
  }
  process.exit(1);
});
