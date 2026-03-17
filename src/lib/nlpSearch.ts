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
  "it support": "Technical Services",
  "computer repair": "Technical Services",
  "laptop repair": "Technical Services",
  "mobile repair": "Technical Services",
  "plumber": "Home Services",
  "electrician": "Home Services",
  "ac repair": "Repair & Maintenance",
  "appliance repair": "Repair & Maintenance",
  "tuition": "Education & Tutoring",
  "tutor": "Education & Tutoring",
  "moving": "Delivery & Logistics",
  "courier": "Delivery & Logistics",
  "fitness": "Health & Personal Care",
  "salon": "Health & Personal Care",
  "consulting": "Business & Consulting",
  "legal": "Business & Consulting",
  "accounting": "Business & Consulting",
  "photography": "Event & Media",
  "dj": "Event & Media",
  "ai": "AI & Automation",
  "automation": "AI & Automation",
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
  if (normQ && (title.includes(normQ) || cat.includes(normQ))) score += 6;

  for (const t of tokens) {
    if (title.includes(t)) score += 4;
    if (cat.includes(t)) score += 3;
    if (desc.includes(t)) score += 2;
  }

  const rating = Number(service?.rating ?? 0);
  if (Number.isFinite(rating)) score += Math.min(5, rating) * 0.3;

  return score;
}

