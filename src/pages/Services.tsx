import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import "@/styles/services-page.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Search, SlidersHorizontal, Star, IndianRupee, Mic, MicOff } from "lucide-react";
import { serviceCategories } from "@/data/marketplace";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import BookingModal from "@/components/booking/BookingModal";
import {
  buildPostgrestOrForTokens,
  scoreServiceMatch,
  suggestCategory,
  tokenize,
} from "@/lib/nlpSearch";

const categoryEmoji: Record<string, string> = {
  "Home Services": "🏠",
  "Technical Services": "💻",
  "Freelance Digital": "🧑‍💻",
  "Repair & Maintenance": "🛠️",
  "Education & Tutoring": "📚",
  "Delivery & Logistics": "🚚",
  "Health & Personal Care": "💆",
  "Business & Consulting": "💼",
  "Event & Media": "📸",
  "AI & Automation": "🤖",
  "Security Services": "🛡️",
  "Express Services": "⚡",
};

const fetchServices = async (opts: {
  category: string | null;
  search: string;
  location: string;
  maxPrice: number;
  minRating: number;
}) => {
  const { data: availableProviders, error: providersError } = await supabase
    .from("profiles")
    .select("id")
    .or("is_available.is.null,is_available.eq.true");

  if (providersError) throw providersError;

  const availableProviderIds = (availableProviders ?? []).map((p: any) => p.id);
  if (availableProviderIds.length === 0) return [];

  let query = supabase
    .from("services")
    .select("*")
    .eq("approval_status", "approved")
    .or("is_active.is.null,is_active.eq.true")
    .in("provider_id", availableProviderIds);

  if (opts.category) query = query.eq("category", opts.category);
  if (opts.search) {
    const inferredCategory = suggestCategory(opts.search, serviceCategories);
    const baseTokens = tokenize(opts.search);
    const extraTokens = inferredCategory ? tokenize(inferredCategory) : [];
    const tokens = Array.from(new Set([...baseTokens, ...extraTokens]));
    const or = buildPostgrestOrForTokens(tokens.length ? tokens : [opts.search]);
    if (or) query = query.or(or);
  }
  if (opts.location) query = query.ilike("location", `%${opts.location}%`);
  if (Number.isFinite(opts.maxPrice)) query = query.lte("price", opts.maxPrice);
  if (opts.minRating > 0) query = query.gte("rating", opts.minRating);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  const inferredCategory = suggestCategory(opts.search, serviceCategories);
  const baseTokens = tokenize(opts.search);
  const extraTokens = inferredCategory ? tokenize(inferredCategory) : [];
  const tokens = Array.from(new Set([...baseTokens, ...extraTokens]));
  const ranked = (data ?? [])
    .map((s: any) => ({
      s,
      score: scoreServiceMatch(s, opts.search, tokens),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
  return ranked;
};

const Services = () => {
  const urlLocation = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [location, setLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState(50000);
  const [minRating, setMinRating] = useState<number>(0);
  const [bookingService, setBookingService] = useState<any>(null);
  const queryClient = useQueryClient();
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any | null>(null);
  const listeningRef = useRef(false);

  // Initialize filters from URL (?q=&cat=&loc=&max=&rating=)
  useEffect(() => {
    const params = new URLSearchParams(urlLocation.search);
    const q = params.get("q") ?? "";
    const cat = params.get("cat");
    const loc = params.get("loc") ?? "";
    const max = params.get("max");
    const rating = params.get("rating");

    if (q) {
      setSearchQuery(q);
      setActiveSearch(q);
    }

    // Only apply category filter if it was explicitly passed.
    setSelectedCategory(cat || null);
    setLocation(loc);

    const maxNum = max ? Number(max) : NaN;
    setMaxPrice(Number.isFinite(maxNum) ? maxNum : 50000);

    const ratingNum = rating ? Number(rating) : NaN;
    setMinRating(Number.isFinite(ratingNum) ? ratingNum : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLocation.search]);

  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ["services", selectedCategory, activeSearch, location, maxPrice, minRating],
    queryFn: () =>
      fetchServices({
        category: selectedCategory,
        search: activeSearch,
        location,
        maxPrice,
        minRating,
      }),
  });

  // Realtime: reflect approvals/activation without refresh
  useEffect(() => {
    const ch = supabase
      .channel("services-marketplace-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === "services",
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === "services",
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const handleSearch = async () => {
    let term = searchQuery;
    const isEnglish = /^[\x00-\x7F\s]+$/.test(term);
    if (!isEnglish) {
      try {
        const { data } = await supabase.functions.invoke("translate-search", { body: { query: term } });
        if (data?.translated) term = data.translated;
      } catch {}
    }
    setActiveSearch(term);
  };

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
        // Stop listening and trigger search automatically once speech is done
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

  return (
    <div className="min-h-screen bg-background services-page-root">
      <Navbar />
      {/* Voice listening overlay */}
      {isListening && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-md">
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

      <div className="container px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-2">Browse Services</h1>
          <p className="text-muted-foreground mb-6">Find the perfect service for your needs — search in any language</p>
          {error ? (
            <div className="mb-4 text-sm text-destructive">
              {(error as any)?.message ? String((error as any).message) : "Search error. Please try again."}
            </div>
          ) : null}

          {/* Search */}
          <div className="glass rounded-2xl p-2 flex items-center gap-2 mb-4 shadow-md services-filter-bar">
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for services (e.g. 'electrician near me', 'cheap plumber')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="border-none bg-transparent shadow-none focus-visible:ring-0"
              />
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
            <Button variant="hero" size="lg" className="rounded-xl" onClick={handleSearch}>
              Search
            </Button>
          </div>

          {/* Filters row */}
          <div className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center services-filter-bar">
            <div className="flex-1 min-w-[180px]">
              <Select
                value={selectedCategory ?? "all"}
                onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}
              >
                <SelectTrigger className="bg-secondary/30 border-border rounded-xl h-11">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {serviceCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 rounded-xl bg-secondary/30 border border-border px-3 h-11">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="border-none bg-transparent shadow-none focus-visible:ring-0 p-0 h-auto"
                />
              </div>
            </div>

            <div className="flex-[1.2] min-w-[240px]">
              <div className="flex items-center gap-3 rounded-xl bg-secondary/30 border border-border px-3 h-11">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Max ₹{maxPrice}
                </span>
                <div className="flex-1">
                  <Slider
                    value={[maxPrice]}
                    min={0}
                      max={50000}
                    step={100}
                    onValueChange={(v) => setMaxPrice(v[0] ?? 0)}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-[170px]">
              <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
                <SelectTrigger className="bg-secondary/30 border-border rounded-xl h-11">
                  <SelectValue placeholder="All Ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Ratings</SelectItem>
                  <SelectItem value="3">3+ stars</SelectItem>
                  <SelectItem value="4">4+ stars</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-2xl p-6 animate-pulse h-64" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted-foreground">No services found</p>
            <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {services.map((service: any) => (
                <motion.div
                  key={service.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass glass-hover rounded-2xl p-6 cursor-pointer group transition-all service-card"
                  onClick={() => setBookingService(service)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                        {service.title?.slice(0, 2)?.toUpperCase() || "SS"}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                        {service.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {service.location && (
                          <span className="inline-flex items-center gap-1">
                            <span>📍</span>
                            <span className="capitalize">{service.location}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/50 text-[11px]">
                          <span>{categoryEmoji[service.category] ?? "🧰"}</span>
                          <span>{service.category}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {service.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium service-category-pill">
                      {service.category}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-warning fill-warning" />
                        <span className="text-sm text-foreground">{service.rating || "New"}</span>
                      </div>
                      <span className="font-display font-bold text-accent flex items-center">
                        <IndianRupee className="w-3.5 h-3.5" />{service.price}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {bookingService && (
        <BookingModal service={bookingService} onClose={() => setBookingService(null)} />
      )}
    </div>
  );
};

export default Services;
