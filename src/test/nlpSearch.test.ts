import { describe, it, expect } from 'vitest';
import { 
  normalizeText, 
  tokenize, 
  suggestCategory, 
  scoreServiceMatch, 
  findBestMatches 
} from '@/lib/nlpSearch';

// Mock service categories for testing (using any to avoid icon type issues)
const mockCategories: any[] = [
  { id: '1', name: 'Home Services', description: 'Plumbing, electrical, cleaning services', icon: '🏠' },
  { id: '2', name: 'Technical Services', description: 'Computer repair, IT support, software help', icon: '💻' },
  { id: '3', name: 'Education & Tutoring', description: 'Private tutoring, coaching classes', icon: '📚' },
];

describe('NLP Search Functions', () => {
  describe('normalizeText', () => {
    it('should normalize text correctly', () => {
      expect(normalizeText('Hello, World!')).toBe('hello world');
      expect(normalizeText('  Computer/Repair  ')).toBe('computer repair');
      expect(normalizeText('CCTV_Camera_System')).toBe('cctv camera system');
      expect(normalizeText('')).toBe('');
    });
  });

  describe('tokenize', () => {
    it('should tokenize and filter stop words', () => {
      expect(tokenize('best computer repair service')).toEqual(['computer', 'repair']);
      expect(tokenize('the quick brown fox')).toEqual(['quick', 'brown', 'fox']);
      expect(tokenize('a an the and or to of in')).toEqual([]);
      expect(tokenize('')).toEqual([]);
    });

    it('should limit tokens to reasonable amount', () => {
      const longText = 'one two three four five six seven eight nine ten eleven twelve';
      expect(tokenize(longText)).toHaveLength(8); // Should be limited
    });
  });

  describe('suggestCategory', () => {
    it('should suggest categories based on synonyms', () => {
      expect(suggestCategory('cctv camera', mockCategories)).toBe('Security Services');
      expect(suggestCategory('plumbing work', mockCategories)).toBe('Home Services');
      expect(suggestCategory('computer repair', mockCategories)).toBe('Technical Services');
      expect(suggestCategory('tuition classes', mockCategories)).toBe('Education & Tutoring');
    });

    it('should return null for non-matching queries', () => {
      expect(suggestCategory('random text xyz', mockCategories)).toBeNull();
      expect(suggestCategory('', mockCategories)).toBeNull();
    });
  });

  describe('scoreServiceMatch', () => {
    const mockService = {
      title: 'Expert Computer Repair',
      description: 'Professional laptop and desktop repair services',
      category: 'Technical Services',
      rating: 4.5,
    };

    it('should score exact matches highest', () => {
      const score = scoreServiceMatch(mockService, 'expert computer repair', ['expert', 'computer', 'repair']);
      expect(score).toBeGreaterThan(20); // Exact match bonus
    });

    it('should score partial matches', () => {
      const score = scoreServiceMatch(mockService, 'computer repair', ['computer', 'repair']);
      expect(score).toBeGreaterThan(10);
      expect(score).toBeLessThan(20);
    });

    it('should score description matches', () => {
      const score = scoreServiceMatch(mockService, 'laptop services', ['laptop', 'services']);
      expect(score).toBeGreaterThan(0);
    });

    it('should include rating bonus', () => {
      const highRatedService = { ...mockService, rating: 5 };
      const lowRatedService = { ...mockService, rating: 2 };
      
      const highScore = scoreServiceMatch(highRatedService, 'computer', ['computer']);
      const lowScore = scoreServiceMatch(lowRatedService, 'computer', ['computer']);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('findBestMatches', () => {
    const mockServices = [
      {
        title: 'Expert Computer Repair',
        description: 'Professional laptop and desktop repair',
        category: 'Technical Services',
        rating: 4.5,
      },
      {
        title: 'Home Plumbing Services',
        description: 'Expert plumbing and pipe repair',
        category: 'Home Services',
        rating: 4.0,
      },
      {
        title: 'Math Tutoring',
        description: 'Private math tutoring for all levels',
        category: 'Education & Tutoring',
        rating: 3.5,
      },
    ];

    it('should return best matches for computer repair query', () => {
      const matches = findBestMatches(mockServices, 'computer repair');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].title).toBe('Expert Computer Repair');
    });

    it('should return empty array for no matches', () => {
      const matches = findBestMatches(mockServices, 'gibberish12345');
      expect(matches).toHaveLength(0);
    });

    it('should limit results to specified limit', () => {
      const matches = findBestMatches(mockServices, 'services', 2);
      expect(matches.length).toBeLessThanOrEqual(2);
    });
  });
});
