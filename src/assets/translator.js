// Client-side Translator integration for on-demand definition translations
// Requires Chrome built-in AI Translator API (behind flags on localhost).
// Uses Chrome Prompt API for generating word translation suggestions.
// Gracefully no-ops if unsupported.

(function () {
  const hasTranslator = typeof self !== 'undefined' && !!self.Translator;
  const hasLanguageDetector = typeof self !== 'undefined' && !!self.LanguageDetector;

  function getAI() {
    if (typeof globalThis !== 'undefined' && globalThis.ai) return globalThis.ai;
    if (typeof window !== 'undefined' && window.ai) return window.ai;
    return null;
  }

  function hasLanguageModel() {
    const aiHandle = getAI();
    return !!(aiHandle && aiHandle.languageModel && typeof aiHandle.languageModel.create === 'function');
  }
  const aiPromptCache = new Map(); // Cache AI-generated suggestions

  function normalizeLang(lang) {
    if (!lang) return 'en';
    return String(lang).toLowerCase().split('-')[0];
  }

  const docLang = normalizeLang(document.documentElement.lang || navigator.language || 'en');
  const fallbackSource = docLang === 'es' ? 'en' : docLang;

  function getLangDisplay(lang) {
    try {
      return new Intl.DisplayNames([docLang], { type: 'language' }).of(normalizeLang(lang)) || String(lang).toUpperCase();
    } catch {
      return String(lang).toUpperCase();
    }
  }

  // Default target: Spanish for English pages; otherwise match page language
  const defaultTarget = docLang === 'en' ? 'es' : docLang;

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
    if (!hasLanguageDetector) return fallbackSource;
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
      return fallbackSource;
    } catch {
      return fallbackSource;
    }
  }

  // Generate word translation suggestions using the Prompt API
  async function generateWordTranslationSuggestions(word, targetLang) {
    const aiHandle = getAI();
    if (!aiHandle || !aiHandle.languageModel) return [];

    const cacheKey = `${word}|${targetLang}`;
    if (aiPromptCache.has(cacheKey)) {
      return aiPromptCache.get(cacheKey);
    }

    try {
      // Check availability first
      const availability = await aiHandle.languageModel.availability();
      console.log('LanguageModel availability:', availability);
      if (availability === 'unavailable') {
        console.warn('LanguageModel is unavailable');
        return [];
      }

      const targetLangName = getLangDisplay(targetLang);
      const sourceLangName = getLangDisplay(docLang);
      
      const prompt = `Provide 3-5 concise word translation suggestions for "${word}" from ${sourceLangName} to ${targetLangName}. 
Format as a simple list, one suggestion per line, without numbering or extra formatting.
Each suggestion should be a single word or short phrase.
If uncertain, provide your best guess.`;

      const session = await aiHandle.languageModel.create({
        topK: 1,
        temperature: 0.3,
      });

      const stream = await session.promptStreaming(prompt);
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
      }
      
      const suggestions = fullResponse
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 50)
        .slice(0, 5);

      aiPromptCache.set(cacheKey, suggestions);
      return suggestions;
    } catch (e) {
      console.warn('Word translation suggestion failed:', e);
      return [];
    }
  }

  function makeButtonLabel(targetLang) {
    const name = getLangDisplay(targetLang);
    if (docLang === 'es') return `Traducir a ${name}`;
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
      const wordDiv = section.querySelector('.word');
      const word = wordDiv ? (wordDiv.textContent || wordDiv.innerText || '').trim() : '';
      
      if (!defBody || !sourceRow) continue;

      const original = document.createElement('div');
      original.className = 'definition-original';
      original.innerHTML = defBody.innerHTML;
      defBody.innerHTML = '';

      const translated = document.createElement('div');
      translated.className = 'definition-translated';
      translated.style.display = 'none';

      // Inline container for the word translation
      const wordTranslation = document.createElement('span');
      wordTranslation.className = 'word-translation';
      wordTranslation.style.display = 'none';
      wordTranslation.style.marginLeft = '8px';
      wordTranslation.style.fontSize = '0.95em';
      wordTranslation.style.color = '#555';
      wordDiv.parentNode.insertBefore(wordTranslation, wordDiv.nextSibling);

      // Container for word suggestions (next to the word)
      const wordSuggestionsContainer = document.createElement('div');
      wordSuggestionsContainer.className = 'word-suggestions-container';
      wordSuggestionsContainer.style.display = 'none';
      wordSuggestionsContainer.style.marginTop = '10px';
      wordSuggestionsContainer.style.fontSize = '0.9em';
      wordSuggestionsContainer.style.color = '#666';
      wordTranslation.parentNode.insertBefore(wordSuggestionsContainer, wordTranslation.nextSibling);

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

          let sourceLang = await detectSourceLanguage(original.textContent || original.innerText || '');
          // Avoid source==target which yields unavailable; assume English if clash on ES pages
          if (sourceLang === lastTargetLang) {
            sourceLang = sourceLang === 'es' ? 'en' : fallbackSource;
          }
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
          btn.textContent = docLang === 'es' ? 'Ver original' : 'Show original';

          // Translate the word label itself for quick reference
          if (word) {
            try {
              const wordOut = await translator.translate(word);
              wordTranslation.textContent = `→ ${wordOut}`;
              wordTranslation.style.display = '';
            } catch (e) {
              console.warn('Failed to translate word label:', e);
              wordTranslation.style.display = 'none';
            }
          }
          
          // Fetch and display word suggestions
          if (hasLanguageModel() && word) {
            try {
              console.log('Generating suggestions for word:', word, 'target lang:', lastTargetLang);
              const suggestions = await generateWordTranslationSuggestions(word, lastTargetLang);
              console.log('Suggestions received:', suggestions);
              if (suggestions.length > 0) {
                const suggestionsHtml = suggestions.map(sugg => `<span style="display: inline-block; margin-right: 8px; padding: 2px 6px; background: #e8f4f8; border-radius: 3px;">${escapeHtml(sugg)}</span>`).join('');
                wordSuggestionsContainer.innerHTML = `<div style="font-weight: 600; margin-bottom: 5px;">${docLang === 'es' ? 'Sugerencias:' : 'Suggestions:'}</div><div>${suggestionsHtml}</div>`;
                wordSuggestionsContainer.style.display = 'block';
                console.log('Word suggestions displayed');
              } else {
                console.log('No suggestions returned');
              }
            } catch (e) {
              console.warn('Failed to generate word suggestions:', e);
            }
          } else {
            console.log('AI not available or no word:', hasLanguageModel(), word);
          }
          
          hasTranslated = true;
          showingTranslated = true;
          btn.disabled = false;
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

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      btn.addEventListener('click', async () => {
        if (!hasTranslator) {
          btn.title = 'Translation not supported in this browser.';
          return;
        }
        if (hasTranslated && showingTranslated) {
          section.__translateState.showOriginal();
          wordSuggestionsContainer.style.display = 'none';
          wordTranslation.style.display = 'none';
        } else if (hasTranslated && !showingTranslated) {
          translated.style.display = '';
          original.style.display = 'none';
          showingTranslated = true;
          btn.textContent = docLang === 'es' ? 'Ver original' : 'Show original';
          if (wordSuggestionsContainer.innerHTML) {
            wordSuggestionsContainer.style.display = '';
          }
          if (wordTranslation.textContent) {
            wordTranslation.style.display = '';
          }
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
      
      // Watch for dynamically added word-entry elements
      const observer = new MutationObserver((mutations) => {
        injectItems(globalTarget);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // Initialize after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
