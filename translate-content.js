require('dotenv').config();
const { Translate } = require('@google-cloud/translate').v2;
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const TRANSLATIONS_DIR = path.join(__dirname, 'src/_translations/pens');
const PENS_DIR = path.join(__dirname, 'src/pens');

// Initialize Google Translate (only if API key is provided)
let translate = null;
if (process.env.GOOGLE_TRANSLATE_API_KEY && process.env.ENABLE_AUTO_TRANSLATION === 'true') {
  translate = new Translate({
    key: process.env.GOOGLE_TRANSLATE_API_KEY
  });
}

/**
 * Load cached translation for a pen
 */
function loadCachedTranslation(penSlug) {
  const cachePath = path.join(TRANSLATIONS_DIR, `${penSlug}.json`);
  
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      return cached;
    } catch (error) {
      console.warn(`⚠️  Could not load cached translation for ${penSlug}:`, error.message);
    }
  }
  
  return null;
}

/**
 * Save translation to cache
 */
function saveCachedTranslation(penSlug, translation) {
  const cachePath = path.join(TRANSLATIONS_DIR, `${penSlug}.json`);
  
  try {
    fs.writeFileSync(cachePath, JSON.stringify(translation, null, 2), 'utf-8');
    console.log(`✅ Cached translation for ${penSlug}`);
  } catch (error) {
    console.warn(`⚠️  Could not save cached translation for ${penSlug}:`, error.message);
  }
}

/**
 * Translate text using Google Translate API
 */
async function translateText(text, targetLang = 'es') {
  if (!translate) {
    return null;
  }
  
  try {
    const [translation] = await translate.translate(text, {
      from: 'en',
      to: targetLang
    });
    return translation;
  } catch (error) {
    console.error(`❌ Translation error:`, error.message);
    return null;
  }
}

/**
 * Translate a pen's content
 */
async function translatePen(penFile) {
  const penSlug = path.basename(penFile, '.md');
  const penPath = path.join(PENS_DIR, penFile);
  
  // Load the pen markdown file
  const fileContents = fs.readFileSync(penPath, 'utf-8');
  const { data: frontmatter, content } = matter(fileContents);
  
  // Check if already has Spanish translations in frontmatter
  if (frontmatter.title_es && frontmatter.description_es) {
    console.log(`⏭️  ${penSlug} already has Spanish translations in frontmatter`);
    return;
  }
  
  // Check cache
  const cached = loadCachedTranslation(penSlug);
  if (cached && cached.title_es && cached.description_es) {
    console.log(`📦 Using cached translation for ${penSlug}`);
    return;
  }
  
  // If no API key or translation disabled, skip
  if (!translate) {
    console.log(`⏭️  Skipping translation for ${penSlug} (auto-translation disabled)`);
    return;
  }
  
  console.log(`🌐 Translating ${penSlug}...`);
  
  // Translate title and description
  const titleEs = frontmatter.title ? await translateText(frontmatter.title) : null;
  const descriptionEs = frontmatter.description ? await translateText(frontmatter.description) : null;
  
  // Translate type if present
  const typeEs = frontmatter.type ? await translateText(frontmatter.type) : null;
  
  // Translate content sections (optional - we'll do a simple translation)
  let contentEs = null;
  if (content && content.trim().length > 0) {
    // For very long content, you might want to split it or skip it
    // For now, we'll translate up to first 2000 characters
    const contentToTranslate = content.substring(0, 2000);
    contentEs = await translateText(contentToTranslate);
  }
  
  // Prepare translation cache
  const translation = {
    slug: penSlug,
    title_es: titleEs,
    description_es: descriptionEs,
    type_es: typeEs,
    content_es: contentEs,
    brand: frontmatter.brand, // Brand names usually don't need translation
    translatedAt: new Date().toISOString()
  };
  
  // Save to cache
  saveCachedTranslation(penSlug, translation);
  
  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Main translation function
 */
async function translateAllPens() {
  // Ensure translations directory exists
  if (!fs.existsSync(TRANSLATIONS_DIR)) {
    fs.mkdirSync(TRANSLATIONS_DIR, { recursive: true });
  }
  
  // Get all pen markdown files
  const penFiles = fs.readdirSync(PENS_DIR)
    .filter(file => file.endsWith('.md'));
  
  console.log(`📝 Found ${penFiles.length} pen files`);
  
  if (!translate) {
    console.log('ℹ️  Auto-translation is disabled. Set ENABLE_AUTO_TRANSLATION=true and add GOOGLE_TRANSLATE_API_KEY to enable.');
    console.log('ℹ️  Using cached translations only.');
  }
  
  // Translate each pen
  for (const penFile of penFiles) {
    await translatePen(penFile);
  }
  
  console.log('✅ Translation process complete!');
}

// Run if called directly
if (require.main === module) {
  translateAllPens().catch(error => {
    console.error('❌ Translation failed:', error);
    process.exit(1);
  });
}

module.exports = { translateAllPens, loadCachedTranslation };
