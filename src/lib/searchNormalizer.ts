import type { ServiceCategory } from "@/data/marketplace";
import {
  expandLocationAliases,
  extractLocationTokens,
  normalizeLocationQuery,
  suggestCategory,
  tokenize,
  transliterateDevanagari,
} from "@/lib/nlpSearch";

type SearchNormalizationResult = {
  query: string;
  normalized_query: string;
  detected_service: string;
  detected_location: string;
  tokens: string[];
  service_tokens: string[];
  location_tokens: string[];
};

const splitRawTerms = (input: string): string[] =>
  input
    .trim()
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .slice(0, 8);

export const normalizeServiceSearch = (
  input: string,
  categories: ServiceCategory[]
): SearchNormalizationResult => {
  const raw = (input || "").trim();
  const transliterated = transliterateDevanagari(raw);
  const normalizedQuery = normalizeLocationQuery(raw) || normalizeLocationQuery(transliterated) || transliterated || raw;

  const inferredCategory =
    suggestCategory(raw, categories) || suggestCategory(normalizedQuery, categories) || "";

  const baseTokens = tokenize(normalizedQuery);
  const translitTokens = tokenize(transliterated);
  const rawTokens = splitRawTerms(raw);

  const tokens = expandLocationAliases(
    Array.from(new Set([...(baseTokens.length ? baseTokens : []), ...rawTokens, ...translitTokens]))
  );

  const locationTokens = extractLocationTokens(raw);
  const serviceTokens = baseTokens.filter((t) => !locationTokens.includes(t));

  return {
    query: normalizedQuery,
    normalized_query: normalizedQuery,
    detected_service: inferredCategory || serviceTokens[0] || "",
    detected_location: locationTokens[0] || "",
    tokens,
    service_tokens: serviceTokens,
    location_tokens: locationTokens,
  };
};
