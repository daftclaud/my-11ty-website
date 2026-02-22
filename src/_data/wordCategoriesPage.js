const fs = require('fs');
const path = require('path');

// Canonical source name mappings
const canonical = {
  'Children of Memory - Adrian Tchaikovsky': 'Children of Memory - Novel by Adrian Tchaikovsky',
  'Love is Blind Mexico': 'Love is Blind - Mexico',
  'Mi Honey': 'Honey',
  'Mi Honey ': 'Honey',
  'Yo a mi Honey': 'Honey',
  'Liga MX futbol': 'Liga MX',
  'Sombra del viento - Novel by Carlos Ruiz Zafón': 'La Sombra del viento - Novel by Carlos Ruiz Zafón',
  'La La Sombra del viento - Novel by Carlos Ruiz Zafón': 'La Sombra del viento - Novel by Carlos Ruiz Zafón',
  'El Horizonte - Periódico local': 'El Horizonte',
  'Periódico local de San Luis Potosí': 'El Horizonte',
  'Museo Leonora Carrington in San Luis Potosi': 'Museo Leonora Carrington - San Luis Potosí',
  'Paint - Lee Hee-Younh': 'Paint - Lee Hee-Young',
  'Me :)': 'Yo',
  'My friend Paty': 'Paty Alvarez',
  "Today's Wordle": 'Wordle',
  'Panadero TikTok': 'TikTok',
  'Used in a Slack message I sent': 'Slack',
  'La Paty': 'Paty Alvarez',
  'Mi mentee Thomas': 'Thomas Ojeda',
  'Chamba': 'Work',
};

// Category keyword lists
const categoryKeywords = {
  'Short Stories': ['Short story'],
  'Books/Novels': [
    'Novel', 'Book', 'J.D. Salinger', 'Haruki Murakami', 'Adrian Tchaikovsky',
    'Kazuo Ishiguro', 'Jostein Gaarder', 'Noah Gordon', 'Cormac McCarthy',
    'Robert M. Pirsig', 'Walter Isaacson', 'Steven Pinker', 'Robert Nozick',
    'Isaac Asimov',
    'Yuval Noah Harari', 'Ray Kurzweil', 'Hannah Ritchie',
    'Around the World in Eighty Days - Jules Verne',
    'El Infinito en un Junco - Irene Vallejo',
    'El Juego del Angel - Carlos Ruiz Zafón',
    'How High We Go in the Dark - Sequoia Nagamatsu',
    'Harry Potter', 'Stories of Your Life and Others - Ted Chiang',
    'Tres enigmas para la Organización - Eduardo Mendoza',
    // Former Non-fiction Books keywords merged here
    'Evolution', 'Instinct', 'Anarchy', 'Nexus', 'Ruido', 'Singularity', 'Reviewed', 'Project',
    'The Phoenix Project - Gene Kim', 'Balanced Scorecard Evolution',
    'The Real Daft Punk', 'This is Lean', 'Designing the Future', 'Libro sobre Responsabilidad Social Empresarial'
  ],
  'Movies/TV/Anime': [
    'TV', 'Anime', 'Movie', 'Podcast', 'Love is Blind', 'Last Week Tonight', 'Netflix',
    'A Few Good Men', 'Exhuma', 'PRI - Crónica del Fin', 'Frieren', 'Debo, puedo y quiero'
  ],
  'News/Press': ['Periódico', 'NYT', 'New York Times', 'Milenio', 'El Horizonte', 'Magazine', 'El noticiero'],
  'Web/Social/Apps': [
    'TikTok', 'Wordle', 'Reddit', 'Slack', 'Wiki', 'Instagram', 'YouTube', 'ChatGPT', 'AltavozMX',
    'Video Deep Learning con Pepe Cantoral PhD.', 'Definition of imbue'
  ],
  'Podcasts': ['Podcast'],
  'Music': ['Song', 'Juan Gabriel'],
  'Personal': [
    'My old website', 'Yo', 'Honey', 'Mi papá', 'Paty Alvarez', 'Alan Zorrilla', 'Thomas Ojeda',
    'Adrian Marcelo', 'Elon Musk', 'Work', 'Coty - Globant', 'Alejandro - Guia en Cusco', 'Domenica',
    'Carlos Rodriguez'
  ],
  'Events/Sports': ['soccer game', 'Rayados', 'Mazatlán', 'NBA', 'Baseball', 'Fox NFL', 'Liga MX'],
  'Academic/Work': ['Masters class', 'homework', 'Paper', 'Tarea de maestría'],
  'Museums/Places': ['Museo', 'Vinicola', 'House of Guinness']
};

function canonicalize(source) {
  const normalized = (source || '').trim();
  return canonical[normalized] || normalized;
}

function categorizeSource(source) {
  const canonical_src = canonicalize(source);
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(k => canonical_src.includes(k))) {
      return category;
    }
  }
  
  return 'Uncategorized';
}

module.exports = function() {
  const wordsByCategory = {};
  const sourcesByCategory = {};
  const categorySet = new Set();
  const allWords = [];
  const wordsDir = path.join(__dirname, '../word-curations');
  
  const files = fs.readdirSync(wordsDir)
    .filter(f => f.endsWith('.md') && f !== 'index.md' && f !== 'word-curations.json')
    .sort();

  files.forEach(file => {
    const filePath = path.join(wordsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const dateStr = file.replace('.md', '');
    
    try {
      // Parse YAML frontmatter manually
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return;
      
      const frontMatterText = match[1];
      const lines = frontMatterText.split('\n');
      let currentWord = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.match(/^\s*[-]\s+word:/)) {
          if (currentWord && currentWord.word) {
            const canonicalSource = canonicalize(currentWord.source);
            const category = categorizeSource(canonicalSource);
            const wordEntry = {
              ...currentWord,
              source: canonicalSource,
              category,
              date: dateStr
            };
            
            if (!wordsByCategory[category]) {
              wordsByCategory[category] = [];
            }
            wordsByCategory[category].push(wordEntry);
            
            // Track sources by category
            if (!sourcesByCategory[category]) {
              sourcesByCategory[category] = {};
            }
            if (!sourcesByCategory[category][canonicalSource]) {
              sourcesByCategory[category][canonicalSource] = [];
            }
            sourcesByCategory[category][canonicalSource].push(wordEntry);
            
            allWords.push(wordEntry);
            categorySet.add(category);
          }
          
          const wordVal = line.replace(/^\s*-\s+word:\s*/, '').trim();
          currentWord = { word: wordVal, definition: '', source: '' };
        } else if (line.match(/^\s+definition:/)) {
          if (currentWord) {
            currentWord.definition = line.replace(/^\s+definition:\s*/, '').trim();
          }
        } else if (line.match(/^\s+source:/)) {
          if (currentWord) {
            currentWord.source = line.replace(/^\s+source:\s*/, '').trim();
          }
        }
      }
      
      // Don't forget the last word
      if (currentWord && currentWord.word) {
        const canonicalSource = canonicalize(currentWord.source);
        const category = categorizeSource(canonicalSource);
        const wordEntry = {
          ...currentWord,
          source: canonicalSource,
          category,
          date: dateStr
        };
        
        if (!wordsByCategory[category]) {
          wordsByCategory[category] = [];
        }
        wordsByCategory[category].push(wordEntry);
        
        // Track sources by category
        if (!sourcesByCategory[category]) {
          sourcesByCategory[category] = {};
        }
        if (!sourcesByCategory[category][canonicalSource]) {
          sourcesByCategory[category][canonicalSource] = [];
        }
        sourcesByCategory[category][canonicalSource].push(wordEntry);
        
        allWords.push(wordEntry);
        categorySet.add(category);
      }
    } catch (e) {
      // Silently skip parse errors
    }
  });

  return {
    wordsByCategory,
    sourcesByCategory,
    categoryList: Array.from(categorySet),
    allWords
  };
};
