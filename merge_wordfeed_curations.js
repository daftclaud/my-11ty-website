const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const srcDir = path.join(__dirname, 'src', 'word-curations');
const generatedDir = path.join(__dirname, 'migration-output', 'wordfeed-word-curations');

function quoteYamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeWordEntry(entry) {
  return {
    word: normalizeText(entry.word),
    definition: normalizeText(entry.definition),
    source: normalizeText(entry.source || 'WordFeed'),
  };
}

function entryKey(entry) {
  return `${entry.word.toLowerCase()}|${entry.definition.toLowerCase()}|${entry.source.toLowerCase()}`;
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

function readWordsFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const dateValue = parsed.data.date instanceof Date
    ? parsed.data.date.toISOString().slice(0, 10)
    : String(parsed.data.date || path.basename(filePath, '.md'));
  const words = Array.isArray(parsed.data.words) ? parsed.data.words.map(normalizeWordEntry) : [];
  return { date: dateValue, words };
}

function writeWordsFile(filePath, date, words) {
  fs.writeFileSync(filePath, buildMarkdownContent(date, words));
}

function mergeGeneratedFiles() {
  const generatedFiles = fs.readdirSync(generatedDir).filter((fileName) => fileName.endsWith('.md'));
  let copied = 0;
  let merged = 0;

  generatedFiles.forEach((fileName) => {
    const generatedPath = path.join(generatedDir, fileName);
    const targetPath = path.join(srcDir, fileName);

    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(generatedPath, targetPath);
      copied += 1;
      return;
    }

    const existing = readWordsFile(targetPath);
    const incoming = readWordsFile(generatedPath);
    const seen = new Set();
    const combined = [];

    [...existing.words, ...incoming.words].forEach((entry) => {
      const normalized = normalizeWordEntry(entry);
      const key = entryKey(normalized);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      combined.push(normalized);
    });

    writeWordsFile(targetPath, existing.date || incoming.date, combined);
    merged += 1;
  });

  return { copied, merged, total: generatedFiles.length };
}

function main() {
  const { copied, merged, total } = mergeGeneratedFiles();

  console.log(`WordFeed merge complete. totalGenerated=${total}, copied=${copied}, merged=${merged}`);
}

main();
