import type { ServiceCategory } from "@/data/marketplace";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "near",
  "me",
  "my",
  "best",
  "cheap",
  "cost",
  "price",
  "service",
  "services",
]);

// Lightweight synonym map to bridge common phrasing → category intent.
// Keep keys lowercase + normalized.
const CATEGORY_SYNONYMS: Record<string, string> = {
  "system security": "Security Services",
  "cyber security": "Security Services",
  cybersecurity: "Security Services",
  "cctv": "Security Services",
  "camera": "Security Services",
  "surveillance": "Security Services",
  "guard": "Security Services",
  "bodyguard": "Security Services",
  "security guard": "Security Services",
  "it support": "Technical Services",
  "computer repair": "Technical Services",
  "laptop repair": "Technical Services",
  "mobile repair": "Technical Services",
  "phone repair": "Technical Services",
  "software issue": "Technical Services",
  "hardware repair": "Technical Services",
  "plumber": "Home Services",
  "plumbing": "Home Services",
  "electrician": "Home Services",
  "electrical work": "Home Services",
  "ac repair": "Repair & Maintenance",
  "air conditioner": "Repair & Maintenance",
  "appliance repair": "Repair & Maintenance",
  "fridge repair": "Repair & Maintenance",
  "washing machine": "Repair & Maintenance",
  "home repair": "Repair & Maintenance",
  "tuition": "Education & Tutoring",
  "tutor": "Education & Tutoring",
  "teacher": "Education & Tutoring",
  "coaching": "Education & Tutoring",
  "study help": "Education & Tutoring",
  "moving": "Delivery & Logistics",
  "courier": "Delivery & Logistics",
  "delivery": "Delivery & Logistics",
  "transport": "Delivery & Logistics",
  "packers": "Delivery & Logistics",
  "fitness": "Health & Personal Care",
  "gym": "Health & Personal Care",
  "salon": "Health & Personal Care",
  "beauty": "Health & Personal Care",
  "spa": "Health & Personal Care",
  "massage": "Health & Personal Care",
  "consulting": "Business & Consulting",
  "legal": "Business & Consulting",
  "accounting": "Business & Consulting",
  "business advice": "Business & Consulting",
  "financial": "Business & Consulting",
  "photography": "Event & Media",
  "dj": "Event & Media",
  "event": "Event & Media",
  "party": "Event & Media",
  "music": "Event & Media",
  "video": "Event & Media",
  "ai": "AI & Automation",
  "automation": "AI & Automation",
  "machine learning": "AI & Automation",
  "chatbot": "AI & Automation",
  "cleaning": "Home Services",
  "house cleaning": "Home Services",
  "carpenter": "Home Services",
  "wood work": "Home Services",
  "painting": "Home Services",
  "home painting": "Home Services",
};

export function normalizeText(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const norm = normalizeText(input);
  if (!norm) return [];
  const parts = norm.split(" ").filter(Boolean);
  const tokens = parts.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  // De-dup while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 8); // keep filters small for PostgREST OR strings
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function suggestCategory(query: string, categories: ServiceCategory[]): string | null {
  const norm = normalizeText(query);
  if (!norm) return null;

  // Direct synonym hit first (covers "system security" → "Security Services")
  for (const [k, v] of Object.entries(CATEGORY_SYNONYMS)) {
    if (norm.includes(k)) return v;
  }

  const qTokens = new Set(tokenize(norm));
  if (qTokens.size === 0) return null;

  let best: { name: string; score: number } | null = null;
  for (const cat of categories) {
    const hay = normalizeText(`${cat.name} ${cat.description}`);
    const cTokens = new Set(tokenize(hay));
    const score = jaccard(qTokens, cTokens);
    if (!best || score > best.score) best = { name: cat.name, score };
  }

  // Require some confidence to avoid wrong auto-category.
  if (!best) return null;
  return best.score >= 0.25 ? best.name : null;
}

export function buildPostgrestOrForTokens(tokens: string[]): string | null {
  if (!tokens.length) return null;
  const clauses: string[] = [];
  for (const t of tokens) {
    const safe = t.replace(/,/g, " ").trim();
    if (!safe) continue;
    clauses.push(`title.ilike.%${safe}%`);
    clauses.push(`description.ilike.%${safe}%`);
    clauses.push(`category.ilike.%${safe}%`);
    clauses.push(`location.ilike.%${safe}%`);
  }
  return clauses.length ? clauses.join(",") : null;
}

export function scoreServiceMatch(service: any, query: string, tokens: string[]): number {
  const title = normalizeText(service?.title ?? "");
  const desc = normalizeText(service?.description ?? "");
  const cat = normalizeText(service?.category ?? "");

  let score = 0;
  const normQ = normalizeText(query);
  
  // Exact title match gets highest score
  if (normQ && title === normQ) score += 20;
  else if (normQ && (title.includes(normQ) || cat.includes(normQ))) score += 8;
  
  // Category match bonus
  if (normQ && cat === normQ) score += 15;
  else if (normQ && cat.includes(normQ)) score += 6;

  // Token-based scoring
  for (const t of tokens) {
    if (title.includes(t)) score += 4;
    if (cat.includes(t)) score += 3;
    if (desc.includes(t)) score += 2;
  }

  // Only add rating bonus if there's some content match
  if (score > 0) {
    // Rating bonus (capped at 5)
    const rating = Number(service?.rating ?? 0);
    if (Number.isFinite(rating)) score += Math.min(5, rating) * 0.3;

    // Description length bonus (more detailed descriptions might be better)
    if (desc.length > 50) score += 0.1;
  }

  return score;
}

export function findBestMatches(services: any[], query: string, limit: number = 10): any[] {
  const tokens = tokenize(query);
  const scored = services.map(service => ({
    service,
    score: scoreServiceMatch(service, query, tokens)
  }));
  
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score > 0) // Only return matches with positive scores
    .slice(0, limit)
    .map(item => item.service);
}

