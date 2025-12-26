// Client-side Translator integration for on-demand definition translations
// Requires Chrome built-in AI Translator API (behind flags on localhost).
// Gracefully no-ops if unsupported.

(function () {
  const hasTranslator = typeof self !== 'undefined' && !!self.Translator;
  const hasLanguageDetector = typeof self !== 'undefined' && !!self.LanguageDetector;

  function normalizeLang(lang) {
    if (!lang) return 'en';
    return String(lang).toLowerCase().split('-')[0];
  }

  const docLang = normalizeLang(document.documentElement.lang || navigator.language || 'en');

  function getLangDisplay(lang) {
    try {
      return new Intl.DisplayNames([docLang], { type: 'language' }).of(normalizeLang(lang)) || String(lang).toUpperCase();
    } catch {
      return String(lang).toUpperCase();
    }
  }

  const defaultTarget = docLang === 'es' ? 'en' : 'es';

  const translatorCache = new Map(); // key: `${source}|${target}` -> Promise<Translator>
  async function getTranslator(sourceLanguage, targetLanguage, monitorHandler) {
    const source = normalizeLang(sourceLanguage);
    const target = normalizeLang(targetLanguage);
    const key = `${source}|${target}`;
    if (!translatorCache.has(key)) {
      const creation = (async () => {
        const availability = await self.Translator.availability({ sourceLanguage: source, targetLanguage: target });
        if (availability === 'unavailable') {
          throw new DOMException('Translation unavailable', 'NotSupportedError');
        }
        const t = await self.Translator.create({
          sourceLanguage: source,
          targetLanguage: target,
          monitor(m) {
            if (typeof monitorHandler === 'function') {
              m.addEventListener('downloadprogress', monitorHandler);
            }
          }
        });
        return t;
      })();
      translatorCache.set(key, creation);
    }
    return translatorCache.get(key);
  }

  let languageDetectorPromise = null;
  async function detectSourceLanguage(text) {
    const sample = (text || '').slice(0, 4000);
    if (!hasLanguageDetector) return docLang;
    try {
      if (!languageDetectorPromise) {
        languageDetectorPromise = self.LanguageDetector.create();
      }
      const detector = await languageDetectorPromise;
      const result = await detector.detect(sample);
      if (Array.isArray(result) && result.length) {
        return normalizeLang(result[0].language || docLang);
      }
      if (result && result.language) {
        return normalizeLang(result.language);
      }
      return docLang;
    } catch {
      return docLang;
    }
  }

  function makeButtonLabel(targetLang) {
    const name = getLangDisplay(targetLang);
    return `Translate to ${name}`;
  }

  function injectItems(globalTargetLang) {
    if (!hasTranslator) return;

    const targetLang = normalizeLang(globalTargetLang || defaultTarget);
    const sections = Array.from(document.querySelectorAll('section.word-entry'));
    if (!sections.length) return;

    for (const section of sections) {
      if (section.dataset.translationReady === 'true') continue;
      section.dataset.translationReady = 'true';
      section.style.position = 'relative';

      const sourceRow = section.querySelector('.source');
      const defBody = section.querySelector('.definition');
      if (!defBody || !sourceRow) continue;

      const original = document.createElement('div');
      original.className = 'definition-original';
      original.innerHTML = defBody.innerHTML;
      defBody.innerHTML = '';

      const translated = document.createElement('div');
      translated.className = 'definition-translated';
      translated.style.display = 'none';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'translate-btn';
      btn.textContent = makeButtonLabel(targetLang);
      btn.style.border = '1px solid #888';
      btn.style.background = '#fff';
      btn.style.color = '#333';
      btn.style.padding = '4px 10px';
      btn.style.borderRadius = '999px';
      btn.style.cursor = 'pointer';
      btn.style.fontWeight = '600';
      // Place the button directly in the `.source` row and push it to the right
      sourceRow.style.display = 'flex';
      sourceRow.style.alignItems = 'center';
      sourceRow.style.gap = '8px';
      btn.style.marginLeft = 'auto';
      sourceRow.appendChild(btn);

      defBody.appendChild(original);
      defBody.appendChild(translated);

      let hasTranslated = false;
      let showingTranslated = false;
      let lastSourceLang = docLang;
      let lastTargetLang = targetLang;

      section.__translateState = {
        translate: async (nextTarget) => {
          lastTargetLang = normalizeLang(nextTarget || lastTargetLang);
          await doTranslate();
        },
        showOriginal: () => {
          translated.style.display = 'none';
          original.style.display = '';
          showingTranslated = false;
          btn.textContent = makeButtonLabel(lastTargetLang);
        },
        isTranslated: () => hasTranslated,
        isShowingTranslated: () => showingTranslated,
        setTarget: (lang) => { lastTargetLang = normalizeLang(lang); btn.textContent = makeButtonLabel(lastTargetLang); }
      };

      async function doTranslate() {
        if (!hasTranslator) return;
        try {
          btn.disabled = true;
          btn.textContent = 'Preparing…';

          const sourceLang = await detectSourceLanguage(original.textContent || original.innerText || '');
          lastSourceLang = sourceLang;

          const translator = await getTranslator(sourceLang, lastTargetLang, (e) => {
            const pct = Math.round(((e && e.loaded) || 0) * 100);
            btn.textContent = `Downloading… ${pct}%`;
          });

          btn.textContent = 'Translating…';
          const out = await translator.translate(original.textContent || original.innerText || '');
          translated.textContent = out;
          translated.style.display = '';
          original.style.display = 'none';
          btn.textContent = 'Show original';
          btn.disabled = false;
          hasTranslated = true;
          showingTranslated = true;
        } catch (e) {
          btn.disabled = false;
          if (e && e.name === 'NotSupportedError') {
            btn.textContent = 'Unavailable';
            btn.title = 'Translation unavailable for selected languages.';
          } else if (e && e.name === 'QuotaExceededError') {
            btn.textContent = 'Too large';
            btn.title = 'Input too large for on-device translation.';
          } else if (e && e.name === 'AbortError') {
            btn.textContent = 'Aborted';
            btn.title = 'Translation aborted.';
          } else {
            btn.textContent = 'Failed. Try again';
            btn.title = 'Translation failed. Try again.';
          }
        }
      }

      btn.addEventListener('click', async () => {
        if (!hasTranslator) {
          btn.title = 'Translation not supported in this browser.';
          return;
        }
        if (hasTranslated && showingTranslated) {
          section.__translateState.showOriginal();
        } else if (hasTranslated && !showingTranslated) {
          translated.style.display = '';
          original.style.display = 'none';
          showingTranslated = true;
          btn.textContent = 'Show original';
        } else {
          await doTranslate();
        }
      });
    }
  }

  function init() {
    const globalTarget = defaultTarget;
    if (hasTranslator) {
      injectItems(globalTarget);
    }
  }

  // Initialize after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
