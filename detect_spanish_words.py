#!/usr/bin/env python3
"""
Scan word curations and detect Spanish words.
Analyzes definitions to detect if they are written in Spanish.
"""

import re
import json
from pathlib import Path

# Configuration
CURATIONS_PATH = Path(__file__).parent / 'src' / 'word-curations'

def load_english_words():
    """Load common English words for language detection."""
    # Common English words that help identify English text
    english_indicators = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
        'it', 'its', 'this', 'that', 'these', 'those', 'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how',
        'as', 'if', 'because', 'while', 'during', 'after', 'before', 'about', 'through', 'from', 'up', 'down', 'out',
        'person', 'people', 'thing', 'time', 'way', 'state', 'quality', 'condition', 'action', 'process',
        'characteristic', 'property', 'attribute', 'one', 'two', 'three', 'first', 'second', 'other'
    }
    return english_indicators

def load_spanish_indicators():
    """Load common Spanish words that help identify Spanish definitions."""
    spanish_indicators = {
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'que', 'y', 'o', 'pero', 'en', 'a',
        'es', 'son', 'era', 'eran', 'fue', 'fueron', 'sea', 'sean', 'ser', 'estar', 'tener', 'hacer',
        'por', 'para', 'con', 'sin', 'sobre', 'bajo', 'ante', 'entre', 'hacia', 'desde', 'hasta',
        'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas',
        'quien', 'quienes', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'donde', 'cuando', 'como', 'porque',
        'persona', 'gente', 'cosa', 'tiempo', 'forma', 'estado', 'cualidad', 'propiedad', 'característica',
        'uno', 'dos', 'tres', 'primero', 'segundo', 'otro', 'muy', 'más', 'menos', 'bien', 'mal'
    }
    return spanish_indicators

def detect_definition_language(definition, english_words, spanish_words):
    """Detect if a definition is in Spanish or English by analyzing common words."""
    if not definition:
        return None
    
    # Convert to lowercase and split into words
    words_in_def = definition.lower().split()
    
    english_count = 0
    spanish_count = 0
    
    for word in words_in_def:
        # Remove punctuation
        clean_word = re.sub(r'^[^a-záéíóúñ]+|[^a-záéíóúñ]+$', '', word)
        
        if clean_word in english_words:
            english_count += 1
        elif clean_word in spanish_words:
            spanish_count += 1
    
    # If we found Spanish indicators and they outnumber English, it's Spanish
    if spanish_count > english_count and spanish_count > 0:
        return 'spanish'
    elif english_count > spanish_count and english_count > 0:
        return 'english'
    
    return None

def extract_words_from_curation(file_path):
    """Extract word data from a curation file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse YAML front matter
        match = re.search(r'^---\s*(.*?)\s*---', content, re.MULTILINE | re.DOTALL)
        if not match:
            return []
        
        frontmatter = match.group(1)
        words_data = []
        
        # Extract words and definitions from YAML
        # Look for word: and definition: pairs
        word_pattern = r'word:\s*(["\']?)([^"\'"\n]+)\1'
        definition_pattern = r'definition:\s*(["\']?)([^"\'"\n]+)\1'
        
        words = re.findall(word_pattern, frontmatter)
        definitions = re.findall(definition_pattern, frontmatter)
        
        for i, (_, word) in enumerate(words):
            word = word.strip()
            if word and len(word) > 1:
                definition = definitions[i][1].strip() if i < len(definitions) else None
                words_data.append({
                    'word': word,
                    'definition': definition,
                    'file': file_path.name,
                    'date_folder': file_path.stem
                })
        
        return words_data
    
    except Exception as e:
        print(f"⚠ Error reading {file_path.name}: {e}")
        return []

def detect_spanish_words():
    """Scan all curations and detect Spanish words by analyzing definitions."""
    if not CURATIONS_PATH.exists():
        raise FileNotFoundError(f"Curations directory not found: {CURATIONS_PATH}")
    
    # Load language indicator words
    english_indicators = load_english_words()
    spanish_indicators = load_spanish_indicators()
    
    spanish_words = []
    total_words = 0
    
    # Look for .md files directly in the curations directory
    curation_files = sorted(CURATIONS_PATH.glob('*.md'))
    print(f"🔍 Scanning {len(curation_files)} curation files...\n")
    
    for i, curation_file in enumerate(curation_files, 1):
        words = extract_words_from_curation(curation_file)
        total_words += len(words)
        
        # Check each word's definition to detect language
        for word_data in words:
            lang = detect_definition_language(word_data['definition'], english_indicators, spanish_indicators)
            
            if lang == 'spanish':
                spanish_words.append(word_data)
        
        # Progress indicator
        if i % 50 == 0:
            print(f"  Progress: {i}/{len(curation_files)} files processed...")
    
    print(f"\n✓ Scanned {total_words:,} total words")
    print(f"✓ Found {len(spanish_words)} Spanish word entries")
    
    return spanish_words

def main():
    print("=" * 70)
    print("Spanish Word Detection Script")
    print("=" * 70 + "\n")
    
    try:
        # Detect Spanish words
        spanish_words = detect_spanish_words()
        
        # Save results to JSON
        output_file = Path(__file__).parent / 'spanish_words_found.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(spanish_words, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Results saved to {output_file.name}")
        
        if spanish_words:
            # Group by word for better display
            word_counts = {}
            for item in spanish_words:
                w = item['word'].lower()
                if w not in word_counts:
                    word_counts[w] = []
                word_counts[w].append(item['date_folder'])
            
            print(f"\n📊 Spanish Words Found ({len(spanish_words)} entries, {len(word_counts)} unique):\n")
            
            # Sort by frequency
            sorted_words = sorted(word_counts.items(), key=lambda x: len(x[1]), reverse=True)
            
            for word, dates in sorted_words[:20]:
                count = len(dates)
                times = "time" if count == 1 else "times"
                print(f"   • {word.capitalize():20} ({count} {times})")
                if count <= 3:
                    print(f"      Found in: {', '.join(dates[:3])}")
            
            if len(word_counts) > 20:
                print(f"   ... and {len(word_counts) - 20} more Spanish words")
        else:
            print("\n   No Spanish words detected in your collection.")
        
        print(f"\n✅ Complete!")
        print(f"   Total entries analyzed: {sum(len(v) for v in word_counts.values()) if spanish_words else 0}")
        print(f"   Unique Spanish words: {len(word_counts) if spanish_words else 0}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
