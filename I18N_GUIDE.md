# 🌐 Internationalization (i18n) Setup Guide

This site now supports both **English** and **Spanish (Mexico)** with automated translation during the build process!

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [File Structure](#file-structure)
- [Using Translations](#using-translations)
- [Adding New Content](#adding-new-content)
- [Translation API Setup](#translation-api-setup)
- [Manual Translation Cache](#manual-translation-cache)

## 🚀 Quick Start

### 1. Install Dependencies

Already done! But if you need to reinstall:

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Optional: Only needed for automatic translation of new pens
GOOGLE_TRANSLATE_API_KEY=your_key_here

# Set to 'true' to enable auto-translation
ENABLE_AUTO_TRANSLATION=false
```

### 3. Build or Develop

```bash
# Development mode
npm run dev

# Production build
npm run build

# Run translation manually
npm run translate
```

## 🔧 How It Works

### Build Process

When you run `npm run build` or `npm run dev`, the following happens:

1. **Spanish Word Detection** runs (existing feature)
2. **Rocket League Stats** are fetched (existing feature)
3. **Content Translation** runs:
   - Checks cache for existing translations
   - Translates new pens if API is configured
   - Saves translations to cache
4. **Site Generation** with both English and Spanish versions

### URL Structure

- **English**: `https://yoursite.com/` (default)
  - `/about/`
  - `/pens/`
  - `/word-curations/`

- **Spanish**: `https://yoursite.com/es/`
  - `/es/about/`
  - `/es/pens/`
  - `/es/word-curations/`

## 📁 File Structure

```
src/
├── _data/
│   ├── i18n/
│   │   ├── en.json          # English UI strings
│   │   └── es-MX.json       # Spanish UI strings
│   └── site.js              # Locale configuration
│
├── _translations/           # Translation cache
│   └── pens/
│       ├── parker-jotter.json
│       └── ...
│
├── en/                      # English pages
│   ├── index.njk
│   └── about.njk
│
├── es/                      # Spanish pages
│   ├── index.njk
│   └── about.njk
│
├── pens/                    # Pen markdown files
│   └── *.md                 # Auto-translated during build
│
└── word-curations/          # Already in Spanish!
    └── *.md
```

## 🎨 Using Translations

### In Templates

Use the `t` filter to get translated strings:

```njk
{# Simple translation #}
<h1>{{ 'nav.home' | t(locale) }}</h1>

{# Nested keys use dot notation #}
<p>{{ 'home.welcome' | t(locale) }}</p>
```

### Adding New UI Strings

1. Edit `src/_data/i18n/en.json`:
```json
{
  "mySection": {
    "title": "My New Section",
    "description": "This is a description"
  }
}
```

2. Edit `src/_data/i18n/es-MX.json`:
```json
{
  "mySection": {
    "title": "Mi Nueva Sección",
    "description": "Esta es una descripción"
  }
}
```

3. Use in templates:
```njk
<h2>{{ 'mySection.title' | t(locale) }}</h2>
<p>{{ 'mySection.description' | t(locale) }}</p>
```

## ➕ Adding New Content

### Adding a New Pen

1. Create your pen markdown file in `src/pens/`:

```markdown
---
title: "My New Pen"
description: "A great writing instrument"
brand: "BrandName"
type: "Fountain Pen"
date: 2025-01-01
---

Content about the pen...
```

2. When you build the site:
   - If `ENABLE_AUTO_TRANSLATION=true` and API key is set:
     - Pen will be auto-translated to Spanish
     - Translation saved to cache
   - If auto-translation is disabled:
     - Cached translation will be used (if exists)
     - Or you can manually create a translation

3. **Manual Translation** (optional):

Create `src/_translations/pens/my-new-pen.json`:
```json
{
  "slug": "my-new-pen",
  "title_es": "Mi Nueva Pluma",
  "description_es": "Un excelente instrumento de escritura",
  "type_es": "Pluma Fuente",
  "brand": "BrandName",
  "content_es": "Contenido sobre la pluma...",
  "translatedAt": "2025-12-24T00:00:00.000Z"
}
```

### Adding a New Page

1. Create English version in `src/en/`:
```njk
---
layout: base.njk
locale: en
permalink: /my-page/
---

<h1>{{ 'myPage.title' | t(locale) }}</h1>
```

2. Create Spanish version in `src/es/`:
```njk
---
layout: base.njk
locale: es
permalink: /es/my-page/
---

<h1>{{ 'myPage.title' | t(locale) }}</h1>
```

3. Add translations to i18n files.

## 🔑 Translation API Setup

### Google Cloud Translation API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Cloud Translation API"
4. Create credentials (API Key)
5. Copy API key to `.env`:
   ```env
   GOOGLE_TRANSLATE_API_KEY=AIzaSyC...your_key
   ENABLE_AUTO_TRANSLATION=true
   ```

### Cost Estimate

- **Google Translate**: $20 per 1M characters
- Your entire pen collection (~37 pens): ~$0.50-$2.00 one-time
- New pens: ~$0.01-$0.05 each

### Alternative: Manual Translation

You can skip the API entirely and:
1. Set `ENABLE_AUTO_TRANSLATION=false`
2. Manually create translation JSON files in `src/_translations/pens/`
3. The system will use cached translations only

## 📝 Translation Cache

Translation cache files are stored in `src/_translations/pens/`:

**Benefits:**
- Translations persist between builds
- No repeated API calls
- Can manually edit/improve translations
- Works offline after initial translation

**Format:**
```json
{
  "slug": "pen-name",
  "title_es": "Spanish Title",
  "description_es": "Spanish Description",
  "type_es": "Spanish Type",
  "brand": "Brand Name (unchanged)",
  "content_es": "Full Spanish content...",
  "translatedAt": "2025-12-24T..."
}
```

## 🌟 Features

- ✅ **Language Switcher** in the top-right corner
- ✅ **SEO-friendly** with hreflang tags
- ✅ **Automatic Translation** for new content (optional)
- ✅ **Translation Caching** to avoid repeated API calls
- ✅ **Locale-aware** date formatting
- ✅ **Spanish (Mexico)** variant support

## 🐛 Troubleshooting

### Translations Not Showing

1. Check that locale is set in frontmatter: `locale: es`
2. Verify translation exists in i18n JSON files
3. Check the filter syntax: `{{ 'key.path' | t(locale) }}`

### Auto-Translation Not Working

1. Verify API key is correct in `.env`
2. Check `ENABLE_AUTO_TRANSLATION=true`
3. Run manually: `npm run translate`
4. Check console for error messages

### Cache Issues

1. Delete cache files in `src/_translations/pens/`
2. Run `npm run translate` again
3. Or manually create translation JSON files

## 🎯 Next Steps

1. **Review translations**: Auto-translations are good but may need refinement
2. **Add more pages**: Create Spanish versions for pens and word-curations pages
3. **Customize**: Edit `src/_data/i18n/es-MX.json` for better translations
4. **Deploy**: Your site is ready for bilingual deployment!

## 📚 Resources

- [Eleventy Documentation](https://www.11ty.dev/docs/)
- [Google Cloud Translation API](https://cloud.google.com/translate/docs)
- [Spanish (Mexico) Locale](https://en.wikipedia.org/wiki/Mexican_Spanish)

---

¡Buena suerte con tu sitio bilingüe! 🇲🇽🇺🇸
