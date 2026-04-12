// Simple test script for the multilingual location normalizer
const { normalizeLocation, normalizeLocations } = require('./src/lib/multilingualLocationNormalizer.ts');

console.log('=== Testing Multilingual Location Normalizer ===\n');

// Test cases
const testCases = [
  'Bangalore',
  'Bombay', 
  'Dilli',
  'Calcutta',
  'Madras',
  'New Delhi',
  '  Bangalore  ',
  'Connaught Place, New Delhi'
];

testCases.forEach((input, index) => {
  try {
    console.log(`Test ${index + 1}: "${input}"`);
    const result = normalizeLocation(input);
    console.log(`  -> "${result.normalized}" (${result.language}, confidence: ${result.confidence})`);
    if (result.corrections.length > 0) {
      console.log(`  Corrections: ${result.corrections.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
});

console.log('=== Batch Test ===');
const batchResult = normalizeLocations(['Bangalore', 'Bombay', 'Dilli']);
console.log(batchResult.map(r => `"${r.original}" -> "${r.normalized}"`).join('\n'));
