/**
 * Multilingual Location Normalizer
 * Handles normalization of location names across different languages
 * Focuses on Hindi to English transliteration and English standardization
 */

// Hindi to English transliteration mappings
const HINDI_TO_ENGLISH_MAP: Record<string, string> = {
  // Common Hindi locations and their English equivalents
  'delhi': 'delhi',
  'dilli': 'delhi', 
  'mumbai': 'mumbai',
  'bombay': 'mumbai',
  'kolkata': 'kolkata',
  'calcutta': 'kolkata',
  'bengaluru': 'bengaluru',
  'bangalore': 'bengaluru',
  'chennai': 'chennai',
  'madras': 'chennai',
  'hyderabad': 'hyderabad',
  'pune': 'pune',
  'poona': 'pune',
  'ahmedabad': 'ahmedabad',
  'surat': 'surat',
  'jaipur': 'jaipur',
  'lucknow': 'lucknow',
  'kanpur': 'kanpur',
  'nagpur': 'nagpur',
  'indore': 'indore',
  'thane': 'thane',
  'bhopal': 'bhopal',
  'visakhapatnam': 'visakhapatnam',
  'vijayawada': 'vijayawada',
  'coimbatore': 'coimbatore',
  'kochi': 'kochi',
  'cochin': 'kochi',
  'agra': 'agra',
  'varanasi': 'varanasi',
  'benares': 'varanasi',
  'meerut': 'meerut',
  'nashik': 'nashik',
  'faridabad': 'faridabad',
  'gurgaon': 'gurgaon',
  'gurugram': 'gurgaon',
  'ghaziabad': 'ghaziabad',
  'rajkot': 'rajkot',
  'vadodara': 'vadodara',
  'baroda': 'vadodara',
  'ludhiana': 'ludhiana',
  'noida': 'noida',
  'greater noida': 'greater noida',
  
  // States and union territories
  'uttar pradesh': 'uttar pradesh',
  'maharashtra': 'maharashtra',
  'bihar': 'bihar',
  'west bengal': 'west bengal',
  'madhya pradesh': 'madhya pradesh',
  'tamil nadu': 'tamil nadu',
  'rajasthan': 'rajasthan',
  'karnataka': 'karnataka',
  'gujarat': 'gujarat',
  'andhra pradesh': 'andhra pradesh',
  'odisha': 'odisha',
  'orissa': 'odisha',
  'telangana': 'telangana',
  'kerala': 'kerala',
  'jammu and kashmir': 'jammu and kashmir',
  'punjab': 'punjab',
  'haryana': 'haryana',
  'uttarakhand': 'uttarakhand',
  'himachal pradesh': 'himachal pradesh',
  'assam': 'assam',
  'jharkhand': 'jharkhand',
  'chhattisgarh': 'chhattisgarh',
  'goa': 'goa',
  'uttaranchal': 'uttarakhand',
  'pondicherry': 'pondicherry',
  'puducherry': 'puducherry',
  
  // Districts and smaller locations
  'east delhi': 'east delhi',
  'west delhi': 'west delhi',
  'north delhi': 'north delhi',
  'south delhi': 'south delhi',
  'central delhi': 'central delhi',
  'new delhi': 'new delhi',
  'old delhi': 'old delhi',
  'connaught place': 'connaught place',
  'cp': 'connaught place',
  'karol bagh': 'karol bagh',
  'chandni chowk': 'chandni chowk',
  'lajpat nagar': 'lajpat nagar',
  'defence colony': 'defence colony',
  'greater kailash': 'greater kailash',
  'gk': 'greater kailash',
  'saket': 'saket',
  'vasant kunj': 'vasant kunj',
  'dwarka': 'dwarka',
  'rohini': 'rohini',
  'pitampura': 'pitampura',
  'janakpuri': 'janakpuri',
  'uttam nagar': 'uttam nagar',
  'tilak nagar': 'tilak nagar',
  'rajouri garden': 'rajouri garden',
  
  // Mumbai specific
  'bandra': 'bandra',
  'andheri': 'andheri',
  'borivali': 'borivali',
  'dadar': 'dadar',
  'churchgate': 'churchgate',
  'colaba': 'colaba',
  'juhu': 'juhu',
  'marine lines': 'marine lines',
  'worli': 'worli',
  'powai': 'powai',
  'goregaon': 'goregaon',
  'kurla': 'kurla',
  'sion': 'sion',
  'matunga': 'matunga',
  'mahim': 'mahim',
  'parel': 'parel',
  
  // Common Hindi words in locations
  'nagar': 'nagar',
  'colony': 'colony',
  'puri': 'puri',
  'ganj': 'ganj',
  'bazar': 'bazar',
  'market': 'market',
  'road': 'road',
  'street': 'street',
  'lane': 'lane',
  'gali': 'lane',
  'chowk': 'chowk',
  'cross': 'cross',
  'circle': 'circle',
  'square': 'square',
  'park': 'park',
  'garden': 'garden',
  'bagh': 'garden',
  'talab': 'lake',
  'lake': 'lake',
  'river': 'river',
  'nadi': 'river',
  'bridge': 'bridge',
  'pul': 'bridge',
  'station': 'station',
  'sthan': 'place',
  'sadar': 'sadar',
  'cantonment': 'cantonment',
  'camp': 'camp',
  'fort': 'fort',
  'qila': 'fort',
  'gate': 'gate',
  'darwaza': 'gate',
  'mandir': 'temple',
  'temple': 'temple',
  'masjid': 'mosque',
  'mosque': 'mosque',
  'church': 'church',
  'gurudwara': 'gurudwara',
};

// English normalization patterns
const ENGLISH_NORMALIZATION_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  // Multiple spaces to single space
  { pattern: /\s+/g, replacement: ' ' },
  // Remove extra punctuation
  { pattern: /[.,;:]+/g, replacement: '' },
  // Common spelling variations
  { pattern: /\bbengaluru\b/gi, replacement: 'bengaluru' },
  { pattern: /\bbangalore\b/gi, replacement: 'bengaluru' },
  { pattern: /\bbombay\b/gi, replacement: 'mumbai' },
  { pattern: /\bcalcutta\b/gi, replacement: 'kolkata' },
  { pattern: /\bmadras\b/gi, replacement: 'chennai' },
  { pattern: /\bpoona\b/gi, replacement: 'pune' },
  { pattern: /\bbaroda\b/gi, replacement: 'vadodara' },
  { pattern: /\bbenares\b/gi, replacement: 'varanasi' },
  { pattern: /\borissa\b/gi, replacement: 'odisha' },
  { pattern: /\bpondicherry\b/gi, replacement: 'puducherry' },
  { pattern: /\buttaranchal\b/gi, replacement: 'uttarakhand' },
  { pattern: /\bgurugram\b/gi, replacement: 'gurgaon' },
];

// Hinglish patterns (mixed Hindi-English)
const HINGLISH_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  // Common Hinglish variations
  { pattern: /\bdilli\b/gi, replacement: 'delhi' },
  { pattern: /\bmumbai\b/gi, replacement: 'mumbai' },
  { pattern: /\bkolkatta\b/gi, replacement: 'kolkata' },
  { pattern: /\bchenai\b/gi, replacement: 'chennai' },
  { pattern: /\bhydrabad\b/gi, replacement: 'hyderabad' },
  { pattern: /\bbanglore\b/gi, replacement: 'bengaluru' },
  { pattern: /\bagra\b/gi, replacement: 'agra' },
  { pattern: /\bjaipur\b/gi, replacement: 'jaipur' },
  { pattern: /\blucknow\b/gi, replacement: 'lucknow' },
  { pattern: /\bkanpur\b/gi, replacement: 'kanpur' },
  { pattern: /\bnagpur\b/gi, replacement: 'nagpur' },
  { pattern: /\bindore\b/gi, replacement: 'indore' },
  { pattern: /\bbhopal\b/gi, replacement: 'bhopal' },
  { pattern: /\bcoimbatore\b/gi, replacement: 'coimbatore' },
  { pattern: /\bcochin\b/gi, replacement: 'kochi' },
  { pattern: /\bvaranasi\b/gi, replacement: 'varanasi' },
  { pattern: /\bmeerut\b/gi, replacement: 'meerut' },
  { pattern: /\bnashik\b/gi, replacement: 'nashik' },
  { pattern: /\bfaridabad\b/gi, replacement: 'faridabad' },
  { pattern: /\bghaziabad\b/gi, replacement: 'ghaziabad' },
  { pattern: /\brajkot\b/gi, replacement: 'rajkot' },
  { pattern: /\bvadodara\b/gi, replacement: 'vadodara' },
  { pattern: /\bludhiana\b/gi, replacement: 'ludhiana' },
  { pattern: /\bnoida\b/gi, replacement: 'noida' },
];

export interface NormalizationResult {
  original: string;
  normalized: string;
  language: 'hindi' | 'english' | 'hinglish' | 'unknown';
  confidence: number;
  corrections: string[];
}

/**
 * Detects the language of the input location string
 */
function detectLanguage(input: string): 'hindi' | 'english' | 'hinglish' | 'unknown' {
  const cleanInput = input.toLowerCase().trim();
  
  // Check for Hindi characters (Devanagari script)
  if (/[\u0900-\u097F]/.test(input)) {
    return 'hindi';
  }
  
  // Check for Hinglish patterns
  const hinglishMatches = HINGLISH_PATTERNS.filter(p => p.pattern.test(cleanInput));
  if (hinglishMatches.length > 0) {
    return 'hinglish';
  }
  
  // Check for English patterns
  const englishMatches = ENGLISH_NORMALIZATION_PATTERNS.filter(p => p.pattern.test(cleanInput));
  if (englishMatches.length > 0 || /^[a-z\s]+$/.test(cleanInput)) {
    return 'english';
  }
  
  return 'unknown';
}

/**
 * Transliterates Hindi text to English
 */
function transliterateHindiToEnglish(input: string): string {
  // For now, we'll handle Romanized Hindi
  // Full Devanagari to English transliteration would require a more complex library
  const cleanInput = input.toLowerCase().trim();
  
  // Apply Hindi to English mappings
  let result = cleanInput;
  
  // Check for exact matches first
  if (HINDI_TO_ENGLISH_MAP[result]) {
    return HINDI_TO_ENGLISH_MAP[result];
  }
  
  // Check for partial matches (word by word)
  const words = result.split(/\s+/);
  const transliteratedWords = words.map(word => {
    if (HINDI_TO_ENGLISH_MAP[word]) {
      return HINDI_TO_ENGLISH_MAP[word];
    }
    return word;
  });
  
  return transliteratedWords.join(' ');
}

/**
 * Normalizes English location names
 */
function normalizeEnglish(input: string): { normalized: string; corrections: string[] } {
  const corrections: string[] = [];
  let normalized = input.toLowerCase().trim();
  
  // Apply normalization patterns
  ENGLISH_NORMALIZATION_PATTERNS.forEach(({ pattern, replacement }) => {
    const before = normalized;
    normalized = normalized.replace(pattern, replacement);
    if (before !== normalized) {
      corrections.push(`Applied pattern: ${pattern.toString()}`);
    }
  });
  
  // Apply Hindi to English mappings for any remaining words
  const words = normalized.split(/\s+/);
  const mappedWords = words.map(word => {
    if (HINDI_TO_ENGLISH_MAP[word] && word !== HINDI_TO_ENGLISH_MAP[word]) {
      corrections.push(`Mapped "${word}" to "${HINDI_TO_ENGLISH_MAP[word]}"`);
      return HINDI_TO_ENGLISH_MAP[word];
    }
    return word;
  });
  
  normalized = mappedWords.join(' ');
  
  // Clean up extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return { normalized, corrections };
}

/**
 * Handles Hinglish (mixed Hindi-English) inputs
 */
function normalizeHinglish(input: string): { normalized: string; corrections: string[] } {
  const corrections: string[] = [];
  let normalized = input.toLowerCase().trim();
  
  // Apply Hinglish patterns first
  HINGLISH_PATTERNS.forEach(({ pattern, replacement }) => {
    const before = normalized;
    normalized = normalized.replace(pattern, replacement);
    if (before !== normalized) {
      corrections.push(`Hinglish correction: ${before} -> ${normalized}`);
    }
  });
  
  // Then apply English normalization
  const englishResult = normalizeEnglish(normalized);
  normalized = englishResult.normalized;
  corrections.push(...englishResult.corrections);
  
  return { normalized, corrections };
}

/**
 * Main function to normalize location names across languages
 */
export function normalizeLocation(input: string): NormalizationResult {
  if (!input || typeof input !== 'string') {
    return {
      original: input || '',
      normalized: '',
      language: 'unknown',
      confidence: 0,
      corrections: ['Invalid input']
    };
  }
  
  const original = input.trim();
  const language = detectLanguage(original);
  let normalized = original;
  const corrections: string[] = [];
  let confidence = 0.5; // Base confidence
  
  try {
    switch (language) {
      case 'hindi':
        normalized = transliterateHindiToEnglish(original);
        confidence = 0.8;
        corrections.push('Transliterated from Hindi to English');
        break;
        
      case 'english':
        const englishResult = normalizeEnglish(original);
        normalized = englishResult.normalized;
        corrections.push(...englishResult.corrections);
        confidence = englishResult.corrections.length > 0 ? 0.9 : 0.7;
        break;
        
      case 'hinglish':
        const hinglishResult = normalizeHinglish(original);
        normalized = hinglishResult.normalized;
        corrections.push(...hinglishResult.corrections);
        confidence = hinglishResult.corrections.length > 0 ? 0.8 : 0.6;
        break;
        
      case 'unknown':
      default:
        // Try basic cleanup for unknown inputs
        normalized = original.toLowerCase().replace(/\s+/g, ' ').trim();
        confidence = 0.3;
        corrections.push('Unknown language, applied basic cleanup');
        break;
    }
    
    // Final validation
    if (normalized.length === 0) {
      corrections.push('Normalization resulted in empty string');
      confidence = 0;
    }
    
  } catch (error) {
    corrections.push(`Error during normalization: ${error}`);
    confidence = 0;
    normalized = original;
  }
  
  return {
    original,
    normalized,
    language,
    confidence,
    corrections
  };
}

/**
 * Batch normalization for multiple locations
 */
export function normalizeLocations(locations: string[]): NormalizationResult[] {
  return locations.map(location => normalizeLocation(location));
}

/**
 * Utility function to check if a location is normalized
 */
export function isNormalized(location: string): boolean {
  const result = normalizeLocation(location);
  return result.normalized === location.toLowerCase().trim() && result.confidence > 0.7;
}

// Export the mapping for external use if needed
export { HINDI_TO_ENGLISH_MAP, ENGLISH_NORMALIZATION_PATTERNS, HINGLISH_PATTERNS };
