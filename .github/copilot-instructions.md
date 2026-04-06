# Copilot Instructions for my-11ty-website

## Project Overview
Personal website built with [Eleventy (11ty)](https://www.11ty.dev/) v3. The main feature is a **Word Curations** section where the owner logs new vocabulary words with their source and definition. The site is bilingual (English + Spanish/`es-MX`) and deployed on Vercel.

## Key Commands
```bash
npm run dev      # Eleventy dev server with live reload
npm run build    # Production build → outputs to public/
npm run translate  # Run content translation (requires Google Cloud credentials)
npm run fetch:rl   # Fetch Rocket League stats (skipped automatically in CI)
```

## Directory Structure
```
.eleventy.js                  # Eleventy config, filters, collections, shortcodes
src/
  _data/
    sourceCategories.js       # Powers category badges on the "By Date" word detail page
    wordCategoriesPage.js     # Powers the /sources/ overview page (SAME category logic, separate file)
    site.js                   # Global site metadata
    i18n/
      en.json                 # English i18n strings
      es-MX.json              # Spanish i18n strings
  _includes/
    filters.js                # Nunjucks filters: getCategory, slugify, md, etc.
    curation.njk              # Word entry card template (uses sourceCategories)
    macros/categoryBadge.njk  # Category badge macro (calls getCategory filter)
    base.njk, month.11ty.js, calendarGrid.11ty.js
  word-curations/             # One .md file per day, e.g. 2026-04-05.md
  word-categories.njk         # /sources/ page (uses wordCategoriesPage data)
  word-curations.njk          # Main word curations list page
  es/                         # Spanish locale pages
  en/                         # English locale pages
public/                       # Build output (gitignored)
```

## Word Curation File Format (`src/word-curations/YYYY-MM-DD.md`)
```yaml
---
date: 2026-04-05
words:
  - word: enact
    definition: act out (a role) on stage.
    source: "Finding Harry: The Craft Behind The Magic"
  - word: anotherword
    definition: some definition
    source: Some Source
---
```
- Source values containing colons **must** be quoted in YAML (e.g. `source: "Title: Subtitle"`).
- Eleventy's YAML parser strips the surrounding quotes; the manual parsers in `sourceCategories.js` and `wordCategoriesPage.js` must also strip them.

## Source Categorization — Critical Architecture Detail
**There are two separate files with duplicated category logic.** Any change to category keywords or the YAML parser must be applied to **both**:

| File | Powers |
|------|--------|
| `src/_data/sourceCategories.js` | Category badges on "By Date" word detail page (`/word-curations/YYYY-MM-DD/`) |
| `src/_data/wordCategoriesPage.js` | `/sources/` overview page — categories sidebar, source cards |

Both files contain:
- A `canonical` object for source name aliases/normalization
- A `categoryKeywords` object mapping category names → keyword arrays
- A manual YAML frontmatter parser that walks `src/word-curations/*.md`
- Quote stripping: `raw.replace(/^["'](.+)["']$/, '$1')` must be applied when extracting `source:` values

The `getCategory` Nunjucks filter (in `src/_includes/filters.js`) looks up `sourceCategories[source]` by exact string match — so the key in the map must exactly match what Eleventy's YAML parser produces (unquoted).

## Category List
`Short Stories`, `Books/Novels`, `Movies/TV/Anime`, `News/Press`, `Web/Social/Apps`, `Podcasts`, `Music`, `Personal`, `Events/Sports`, `Academic/Work`, `Museums/Places`, `Uncategorized`

## i18n / Bilingual Setup
- Locale-specific pages live under `src/es/` and `src/en/`
- Translation filter: `'key.path' | t(locale)` — translations defined in `src/_data/i18n/`
- Content translation is cached; run `npm run translate` to regenerate

## Automated Workflows
- `.github/workflows/fetch-stats.yml` — periodically fetches Rocket League stats and commits `rocket_league_stats.json`

## Things to Watch Out For
- **Never edit only one of the two category files** — `sourceCategories.js` and `wordCategoriesPage.js` must always be kept in sync (keywords, canonical aliases, YAML parser fixes).
- YAML-quoted sources (containing colons) require the quote-stripping regex in both manual parsers.
- `public/` is the build output directory (not `_site`).
- Rocket League stats fetch is skipped in CI/Vercel/Netlify (`process.env.VERCEL || process.env.NETLIFY || process.env.CI`).
