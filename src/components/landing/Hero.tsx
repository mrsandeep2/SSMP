import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, Sparkles, Globe, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { serviceCategories } from "@/data/marketplace";
import { suggestCategory, tokenize } from "@/lib/nlpSearch";

type SearchSuggestion = {
  label: string;
  query: string;
  category?: string;
  count: number;
  matchSource?: "title" | "category" | "description";
};

const countWords = (input: string): number =>
  input
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

const splitRawTerms = (input: string): string[] =>
  input
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);

const includesAnyTerm = (text: string, terms: string[]) => {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t.toLowerCase()));
};

const Hero = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hints, setHints] = useState<SearchSuggestion[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsChecked, setSuggestionsChecked] = useState(false);
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [translating, setTranslating] = useState(false);
  const hintRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any | null>(null);
  const listeningRef = useRef(false);
  const navigate = useNavigate();

  // Translate if non-English, then search
  const translateQuery = async (query: string): Promise<string> => {
    const isEnglish = /^[\x00-\x7F\s]+$/.test(query);
    if (isEnglish) return query;
    
    try {
      setTranslating(true);
      const { data, error } = await supabase.functions.invoke("translate-search", {
        body: { query },
      });
      setTranslating(false);
      if (error) return query;
      return data?.translated || query;
    } catch {
      setTranslating(false);
      return query;
    }
  };

  const getAvailableProviderIds = async (): Promise<string[]> => {
    const { data: availableProviders } = await supabase
      .from("profiles")
      .select("id")
      .or("is_available.is.null,is_available.eq.true");

    return (availableProviders ?? []).map((p: any) => p.id);
  };

  const fetchSearchableServices = async (providerIds: string[], category?: string) => {
    if (providerIds.length === 0) return [] as any[];

    let query = supabase
      .from("services")
      .select("title, category, description")
      .eq("approval_status", "approved")
      .or("is_active.is.null,is_active.eq.true")
      .in("provider_id", providerIds)
      .limit(150);

    if (category) query = query.eq("category", category);

    const { data } = await query;
    return data ?? [];
  };

  const countAvailableServices = async (query: string, category?: string): Promise<number> => {
    const availableProviderIds = await getAvailableProviderIds();
    if (availableProviderIds.length === 0) return 0;

    const services = await fetchSearchableServices(availableProviderIds, category);
    const tokens = tokenize(query);
    const rawTerms = splitRawTerms(query);
    const terms = Array.from(new Set([...(tokens.length ? tokens : []), ...rawTerms]));
    const effectiveTerms = terms.length ? terms : [query.trim()];

    return services.filter((s: any) => {
      const title = String(s?.title ?? "");
      const cat = String(s?.category ?? "");
      const desc = String(s?.description ?? "");
      return (
        includesAnyTerm(title, effectiveTerms) ||
        includesAnyTerm(cat, effectiveTerms) ||
        includesAnyTerm(desc, effectiveTerms)
      );
    }).length;
  };

  useEffect(() => {
    const words = countWords(searchQuery);
    if (words >= 1) {
      const t = setTimeout(async () => {
        setSuggestionsLoading(true);
        setSuggestionsChecked(false);
        setAvailabilityNote("");
        const translated = await translateQuery(searchQuery);
        const availableProviderIds = await getAvailableProviderIds();

        if (availableProviderIds.length === 0) {
          setHints([]);
          setShowHints(true);
          setSuggestionsLoading(false);
          setSuggestionsChecked(true);
          return;
        }

        const inferredCategory = suggestCategory(translated, serviceCategories);
        const searchTokens = tokenize(translated);
        const rawTerms = splitRawTerms(translated);
        const originalRawTerms = splitRawTerms(searchQuery);
        const terms = Array.from(
          new Set([...(searchTokens.length ? searchTokens : []), ...rawTerms, ...originalRawTerms])
        );
        const effectiveTerms = terms.length ? terms : [translated.trim()];

        let data: any[] = [];
        try {
          const source = await fetchSearchableServices(availableProviderIds);
          data = source.filter((s: any) => {
            const title = String(s?.title ?? "");
            const category = String(s?.category ?? "");
            const description = String(s?.description ?? "");
            return (
              includesAnyTerm(title, effectiveTerms) ||
              includesAnyTerm(category, effectiveTerms) ||
              includesAnyTerm(description, effectiveTerms)
            );
          });
        } catch {
          data = [];
        }

        const titleCounts = new Map<string, number>();
        const categoryCounts = new Map<string, number>();
        const descriptionCounts = new Map<string, number>();
        (data ?? []).forEach((s: any) => {
          const title = String(s?.title ?? "").trim();
          const category = String(s?.category ?? "").trim();
          const description = String(s?.description ?? "").trim();

          const titleOrCategoryMatch = includesAnyTerm(title, effectiveTerms) || includesAnyTerm(category, effectiveTerms);
          const descriptionMatch = includesAnyTerm(description, effectiveTerms);

          if (s?.title) {
            titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
          }
          if (s?.category) {
            categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
          }

          // Explicitly track services that matched by description words.
          if (descriptionMatch && !titleOrCategoryMatch && title) {
            descriptionCounts.set(title, (descriptionCounts.get(title) ?? 0) + 1);
          }
        });

        const suggestions: SearchSuggestion[] = [];

        // Prioritize exact title matches
        const exactTitleMatches = data.filter((s: any) => {
          const title = String(s?.title ?? "").trim().toLowerCase();
          return title === translated.trim().toLowerCase();
        });

        if (exactTitleMatches.length > 0) {
          suggestions.push({
            label: `Exact match: ${exactTitleMatches[0].title} (${exactTitleMatches.length})`,
            query: exactTitleMatches[0].title,
            count: exactTitleMatches.length,
            matchSource: "title",
          });
        }

        if (inferredCategory) {
          const count = categoryCounts.get(inferredCategory) ?? 0;
          if (count > 0 && !suggestions.some(s => s.category === inferredCategory)) {
            suggestions.push({
              label: `${inferredCategory} (${count})`,
              query: translated,
              category: inferredCategory,
              count,
              matchSource: "category",
            });
          }
        }

        // Add title matches (excluding exact matches already added)
        for (const [title, count] of Array.from(titleCounts.entries()).sort((a, b) => b[1] - a[1])) {
          if (suggestions.some(s => s.query.toLowerCase() === title.toLowerCase())) continue;
          suggestions.push({ 
            label: `${title} (${count})`, 
            query: title, 
            count, 
            matchSource: "title" 
          });
          if (suggestions.length >= 6) break;
        }

        // Add description matches if still need more suggestions
        if (suggestions.length < 6) {
          for (const [title, count] of Array.from(descriptionCounts.entries()).sort((a, b) => b[1] - a[1])) {
            if (suggestions.some((s) => s.query.toLowerCase() === title.toLowerCase())) continue;
            suggestions.push({
              label: `${title} (desc match ${count})`,
              query: title,
              count,
              matchSource: "description",
            });
            if (suggestions.length >= 6) break;
          }
        }

        // Add category matches if still need more suggestions
        if (suggestions.length < 6) {
          for (const [category, count] of Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])) {
            if (suggestions.some((s) => s.category === category)) continue;
            suggestions.push({
              label: `${category} (${count})`,
              query: translated,
              category,
              count,
              matchSource: "category",
            });
            if (suggestions.length >= 6) break;
          }
        }

        const arr = suggestions.slice(0, 6);
        setHints(arr);
        setShowHints(true);
        setSuggestionsLoading(false);
        setSuggestionsChecked(true);
      }, 300);
      return () => clearTimeout(t);
    } else {
      setHints([]);
      setShowHints(false);
      setSuggestionsLoading(false);
      setSuggestionsChecked(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (hintRef.current && !hintRef.current.contains(e.target as Node)) setShowHints(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const startVoiceSearch = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        transcript = transcript.trim();
        setVoiceTranscript(transcript);
        if (transcript) {
          setSearchQuery(transcript);
        }
      };

      recognition.onend = () => {
        listeningRef.current = false;
        setIsListening(false);
        if (voiceTranscript || searchQuery) {
          handleSearch();
        }
      };

      recognition.onerror = () => {
        listeningRef.current = false;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    setVoiceTranscript("");
    listeningRef.current = true;
    setIsListening(true);
    recognitionRef.current.start();
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    listeningRef.current = false;
    setIsListening(false);
  };

  const handleSearch = async () => {
    setAvailabilityNote("");
    const translated = (await translateQuery(searchQuery)).trim();
    if (!translated) return;
    const params = new URLSearchParams();
    params.set("q", translated);
    navigate(`/services?${params.toString()}`);
  };

  const selectHint = async (suggestion: SearchSuggestion) => {
    const chosenQuery = suggestion.query || searchQuery;
    setSearchQuery(chosenQuery);
    setShowHints(false);

    // Show loading state while checking availability
    setAvailabilityNote("Checking service availability...");

    const availableCount = await countAvailableServices(chosenQuery, suggestion.category);
    if (availableCount <= 0) {
      setAvailabilityNote(`No services available for "${suggestion.label}" right now. Try a different search.`);
      return;
    }

    setAvailabilityNote(`Found ${availableCount} service${availableCount > 1 ? 's' : ''} matching your search!`);

    const params = new URLSearchParams();
    params.set("q", chosenQuery);
    if (suggestion.category) params.set("cat", suggestion.category);
    if (suggestion.matchSource) params.set("src", suggestion.matchSource);
    
    // Small delay to show the success message before navigation
    setTimeout(() => {
      navigate(`/services?${params.toString()}`);
    }, 500);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/8 to-warning/10" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-warning/15 rounded-full blur-[80px] animate-pulse-glow" style={{ animationDelay: "3s" }} />

      {/* Voice listening overlay */}
      {isListening && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Mic className="w-12 h-12 md:w-16 md:h-16 text-primary" />
            </div>
            <p className="text-sm md:text-base text-muted-foreground min-h-[1.5rem]">
              {voiceTranscript || "Listening... speak your service request"}
            </p>
            <Button variant="outline" size="sm" onClick={stopVoiceSearch}>
              <MicOff className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
        </div>
      )}

      <div className="container relative z-10 px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 mb-8 animate-float-soft"
          >
            <Sparkles className="w-4 h-4 text-warning" />
            <span className="text-sm text-muted-foreground">AI-Powered Service Marketplace</span>
            <Globe className="w-4 h-4 text-accent" />
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold font-display leading-tight mb-6 text-foreground">
            Find Any Service.{" "}
            <span className="gradient-text">Instantly.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Connect with verified professionals for any task. Search in any language — 
            one platform, unlimited possibilities.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="max-w-2xl mx-auto mb-6 relative"
            ref={hintRef}
          >
            <div className="glass rounded-2xl p-2 flex items-center gap-2 shadow-lg">
              <div className="flex-1 flex items-center gap-3 px-4">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search in any language... e.g. 'electrician', 'plumbing near me'"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAvailabilityNote("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  onFocus={() => hints.length > 0 && setShowHints(true)}
                  className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground py-3"
                />
                {translating && <span className="text-xs text-accent animate-pulse">Translating...</span>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                aria-label="Voice search"
              >
                {isListening ? (
                  <MicOff className="w-5 h-5 text-destructive" />
                ) : (
                  <Mic className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
              <Button variant="hero" size="lg" className="rounded-xl px-8" onClick={handleSearch}>
                Search
              </Button>
            </div>
            {showHints && (
              <div className="absolute z-50 w-full mt-1 glass rounded-xl overflow-hidden shadow-lg">
                {hints.length > 0 ? (
                  hints.map((h) => (
                    <button
                      key={`${h.label}-${h.query}-${h.category ?? "none"}`}
                      onClick={() => selectHint(h)}
                      className="w-full text-left px-5 py-3 text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-3 border-b last:border-b-0 border-border/20"
                    >
                      <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{h.label}</div>
                        {h.matchSource === "description" && (
                          <div className="text-xs text-muted-foreground">Matched from description</div>
                        )}
                        {h.matchSource === "title" && h.label.includes("Exact match") && (
                          <div className="text-xs text-emerald-600">Perfect match</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground bg-accent/20 px-2 py-1 rounded-full">
                        {h.count}
                      </div>
                    </button>
                  ))
                ) : suggestionsChecked && !suggestionsLoading ? (
                  <div className="px-5 py-3 text-sm text-muted-foreground">No suggestions found</div>
                ) : null}
              </div>
            )}
            {!showHints && suggestionsLoading && countWords(searchQuery) >= 1 ? (
              <div className="absolute z-50 w-full mt-1 glass rounded-xl px-5 py-3 text-sm text-muted-foreground shadow-lg">
                Finding suggestions...
              </div>
            ) : null}
            {availabilityNote ? (
              <p className="text-sm text-warning mt-2">{availabilityNote}</p>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6"
          >
            <Link to="/register" className="w-full sm:w-auto">
              <Button variant="hero" size="lg" className="h-12 w-full rounded-xl px-8 text-base sm:w-auto">
                Get Started <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <Link to="/register?role=provider" className="w-full sm:w-auto">
              <Button variant="glass" size="lg" className="h-12 w-full rounded-xl px-8 text-base sm:w-auto">
                Become a Provider
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
