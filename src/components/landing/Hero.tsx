import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
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
import { MapPin, Search, ArrowRight, Sparkles, Globe, SlidersHorizontal, Star, Mic, MicOff } from "lucide-react";
import { serviceCategories } from "@/data/marketplace";
import { supabase } from "@/integrations/supabase/client";

const Hero = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [minRating, setMinRating] = useState<number>(0);
  const [hints, setHints] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);
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

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const t = setTimeout(async () => {
        const translated = await translateQuery(searchQuery);
        const { data: availableProviders } = await supabase
          .from("profiles")
          .select("id")
          .or("is_available.is.null,is_available.eq.true");
        const availableProviderIds = (availableProviders ?? []).map((p: any) => p.id);

        if (availableProviderIds.length === 0) {
          setHints([]);
          setShowHints(false);
          return;
        }

        const { data } = await supabase
          .from("services")
          .select("title, category")
          .eq("approval_status", "approved")
          .or("is_active.is.null,is_active.eq.true")
          .in("provider_id", availableProviderIds)
          .or(`title.ilike.%${translated}%,category.ilike.%${translated}%`)
          .limit(5);
        const h = new Set<string>();
        (data ?? []).forEach((s: any) => {
          if (s.title.toLowerCase().includes(translated.toLowerCase())) h.add(s.title);
          if (s.category.toLowerCase().includes(translated.toLowerCase())) h.add(s.category);
        });
        // Also add category matches from local data
        serviceCategories.forEach(c => {
          if (c.name.toLowerCase().includes(translated.toLowerCase())) h.add(c.name);
        });
        const arr = Array.from(h).slice(0, 6);
        setHints(arr);
        setShowHints(arr.length > 0);
      }, 300);
      return () => clearTimeout(t);
    } else {
      setHints([]);
      setShowHints(false);
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
    const translated = await translateQuery(searchQuery);
    const params = new URLSearchParams();
    if (translated) params.set("q", translated);
    // Only filter by category if user explicitly selected one.
    if (selectedCategory) params.set("cat", selectedCategory);
    if (location) params.set("loc", location);
    if (Number.isFinite(maxPrice)) params.set("max", String(maxPrice));
    if (minRating > 0) params.set("rating", String(minRating));
    navigate(`/services?${params.toString()}`);
  };

  const selectHint = (h: string) => {
    setSearchQuery(h);
    setShowHints(false);
    const params = new URLSearchParams();
    params.set("q", h);
    navigate(`/services?${params.toString()}`);
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
                  placeholder="Search in any language... e.g. 'khana banane wali chahiye'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                {hints.map((h) => (
                  <button
                    key={h}
                    onClick={() => selectHint(h)}
                    className="w-full text-left px-5 py-3 text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-3"
                  >
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    {h}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Filters row (replaces old hardcoded category pills) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <div className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
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
                      max={20000}
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
                    <SelectItem value="3">
                      <span className="inline-flex items-center gap-2">
                        <Star className="w-4 h-4 text-warning fill-warning" /> 3+ stars
                      </span>
                    </SelectItem>
                    <SelectItem value="4">
                      <span className="inline-flex items-center gap-2">
                        <Star className="w-4 h-4 text-warning fill-warning" /> 4+ stars
                      </span>
                    </SelectItem>
                    <SelectItem value="5">
                      <span className="inline-flex items-center gap-2">
                        <Star className="w-4 h-4 text-warning fill-warning" /> 5 stars
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="flex items-center justify-center gap-6"
          >
            <Link to="/register">
              <Button variant="hero" size="lg" className="rounded-xl text-base px-8 h-12">
                Get Started <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <Link to="/register?role=provider">
              <Button variant="glass" size="lg" className="rounded-xl text-base px-8 h-12">
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
