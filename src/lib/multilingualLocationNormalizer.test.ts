/**
 * Test file for Multilingual Location Normalizer
 * Tests various input scenarios and edge cases
 */

import { normalizeLocation, normalizeLocations, isNormalized } from './multilingualLocationNormalizer';

// Test cases
const testCases = [
  // English normalization tests
  {
    input: 'Bangalore',
    expected: 'bengaluru',
    description: 'Bangalore to Bengaluru'
  },
  {
    input: 'Bombay',
    expected: 'mumbai', 
    description: 'Bombay to Mumbai'
  },
  {
    input: 'Calcutta',
    expected: 'kolkata',
    description: 'Calcutta to Kolkata'
  },
  {
    input: 'Madras',
    expected: 'chennai',
    description: 'Madras to Chennai'
  },
  {
    input: 'Poona',
    expected: 'pune',
    description: 'Poona to Pune'
  },
  {
    input: 'Baroda',
    expected: 'vadodara',
    description: 'Baroda to Vadodara'
  },
  {
    input: 'Benares',
    expected: 'varanasi',
    description: 'Benares to Varanasi'
  },
  {
    input: 'Orissa',
    expected: 'odisha',
    description: 'Orissa to Odisha'
  },
  
  // Hinglish tests
  {
    input: 'Dilli',
    expected: 'delhi',
    description: 'Hinglish Dilli to Delhi'
  },
  {
    input: 'Mumbai',
    expected: 'mumbai',
    description: 'Hinglish Mumbai (already correct)'
  },
  {
    input: 'Banglore',
    expected: 'bengaluru',
    description: 'Hinglish Banglore to Bengaluru'
  },
  {
    input: 'Kolkatta',
    expected: 'kolkata',
    description: 'Hinglish Kolkatta to Kolkata'
  },
  {
    input: 'Hydrabad',
    expected: 'hyderabad',
    description: 'Hinglish Hydrabad to Hyderabad'
  },
  
  // Hindi transliteration tests (Romanized)
  {
    input: 'dilli',
    expected: 'delhi',
    description: 'Romanized Hindi dilli to Delhi'
  },
  {
    input: 'bombay',
    expected: 'mumbai',
    description: 'Romanized Hindi bombay to Mumbai'
  },
  {
    input: 'calcutta',
    expected: 'kolkata',
    description: 'Romanized Hindi calcutta to Kolkata'
  },
  
  // Spacing and punctuation tests
  {
    input: 'New Delhi',
    expected: 'new delhi',
    description: 'Proper case to lowercase'
  },
  {
    input: 'MUMBAI',
    expected: 'mumbai',
    description: 'Uppercase to lowercase'
  },
  {
    input: '  Bangalore  ',
    expected: 'bengaluru',
    description: 'Extra spaces cleanup'
  },
  {
    input: 'Bangalore, Karnataka',
    expected: 'bengaluru karnataka',
    description: 'Punctuation removal'
  },
  {
    input: 'South   Delhi',
    expected: 'south delhi',
    description: 'Multiple spaces to single'
  },
  
  // Complex location tests
  {
    input: 'Connaught Place, New Delhi',
    expected: 'connaught place new delhi',
    description: 'Complex location with comma'
  },
  {
    input: 'Bandra West, Mumbai',
    expected: 'bandra west mumbai',
    description: 'Mumbai area location'
  },
  {
    input: 'Karol Bagh, Dilli',
    expected: 'karol bagh delhi',
    description: 'Delhi area with Hinglish'
  },
  
  // Edge cases
  {
    input: '',
    expected: '',
    description: 'Empty string'
  },
  {
    input: '   ',
    expected: '',
    description: 'Whitespace only'
  },
  {
    input: 'Unknown City',
    expected: 'unknown city',
    description: 'Unknown location (basic cleanup)'
  },
  {
    input: '123',
    expected: '123',
    description: 'Numbers only'
  }
];

// Function to run tests
function runTests(): void {
  console.log('=== Multilingual Location Normalizer Tests ===\n');
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    const result = normalizeLocation(testCase.input);
    const success = result.normalized === testCase.expected;
    
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Got: "${result.normalized}"`);
    console.log(`Language: ${result.language}`);
    console.log(`Confidence: ${result.confidence}`);
    
    if (result.corrections.length > 0) {
      console.log(`Corrections: ${result.corrections.join(', ')}`);
    }
    
    console.log(`Status: ${success ? 'PASS' : 'FAIL'}`);
    console.log('---');
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\n=== Test Results ===`);
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
}

// Test batch normalization
function testBatchNormalization(): void {
  console.log('\n=== Batch Normalization Test ===');
  
  const locations = [
    'Bangalore',
    'Bombay', 
    'Dilli',
    'Calcutta',
    'Madras',
    'Unknown City'
  ];
  
  const results = normalizeLocations(locations);
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. "${result.original}" -> "${result.normalized}" (${result.language}, ${result.confidence})`);
  });
}

// Test isNormalized utility
function testIsNormalized(): void {
  console.log('\n=== Is Normalized Test ===');
  
  const testLocations = [
    'mumbai',
    'bangalore',
    'delhi',
    'new delhi',
    'unknown city'
  ];
  
  testLocations.forEach(location => {
    const normalized = isNormalized(location);
    console.log(`"${location}" is normalized: ${normalized}`);
  });
}

// Export test functions for potential use in test frameworks
export { runTests, testBatchNormalization, testIsNormalized };

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runTests();
  testBatchNormalization();
  testIsNormalized();
}
