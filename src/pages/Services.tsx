import React, { useState, useEffect, useRef } from "react";
import * as Icons from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
import { useToast } from "@/hooks/use-toast";
import BookingModal from "@/components/booking/BookingModal";
import {
  buildPostgrestOrForTokens,
  scoreServiceMatch,
  suggestCategory,
  tokenize,
} from "@/lib/nlpSearch";
import Seo from "@/components/seo/Seo";

const categoryEmoji: Record<string, string> = {
  "Home Services": "🏠",
  "Technical Services": "💻",
  "Freelance Digital": "💼",
  "Repair & Maintenance": "🔧",
  "Education & Tutoring": "📚",
  "Delivery & Logistics": "🚚",
};

const Services = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState(50000);
  const [minRating, setMinRating] = useState(0);
  const [bookingService, setBookingService] = useState<any>(null);

  // Voice search states
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const listeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Parse URL params for search
  const searchParams = new URLSearchParams(location.search);
  const activeSearch = searchParams.get("q") || "";
  const matchSource = searchParams.get("source") || "";
  const isServiceTypeSearched = !!activeSearch;

  // Initialize search from URL
  useEffect(() => {
    if (activeSearch) {
      setSearchQuery(activeSearch);
    }
  }, [activeSearch]);

  useEffect(() => {
    const urlCategory = searchParams.get("cat");
    setSelectedCategory(urlCategory || null);
  }, [location.search]);

  // Voice search setup
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.log("Speech recognition not supported");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setVoiceTranscript(transcript);
      setSearchQuery(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      listeningRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      listeningRef.current = false;
    };

    recognitionRef.current = recognition;
  }, []);

  // Voice search functions
  const startVoiceSearch = () => {
    if (!recognitionRef.current || listeningRef.current) return;
    
    setIsListening(true);
    listeningRef.current = true;
    setVoiceTranscript("");
    recognitionRef.current.start();
  };

  const stopVoiceSearch = () => {
    if (!recognitionRef.current || !listeningRef.current) return;
    
    recognitionRef.current.stop();
    setIsListening(false);
    listeningRef.current = false;
  };

  // Search function
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    const params = new URLSearchParams();
    params.set("q", searchQuery.trim());
    navigate(`/services?${params.toString()}`);
  };

  // Fetch services
  const { data: services, isLoading, error } = useQuery({
    queryKey: ["services", activeSearch, selectedCategory, locationFilter, maxPrice, minRating],
    queryFn: async () => {
      let query = supabase
        .from("services")
        .select(`
          id,
          title,
          description,
          price,
          category,
          location,
          rating,
          review_count,
          created_at,
          provider_id
        `)
        .eq("approval_status", "approved");

      // Apply NLP search if there's an active search
      if (activeSearch) {
        const inferredCategory = suggestCategory(activeSearch, serviceCategories);
        const nlpTokens = tokenize(activeSearch);
        const rawTokens = activeSearch
          .trim()
          .split(/\s+/)
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 2)
          .slice(0, 8);
        const extraTokens = inferredCategory ? tokenize(inferredCategory) : [];
        const tokens = Array.from(new Set([...nlpTokens, ...rawTokens, ...extraTokens]));
        const orClauses = buildPostgrestOrForTokens(tokens.length ? tokens : [activeSearch]);
        if (orClauses) {
          query = query.or(orClauses);
        }
      }

      // Apply filters
      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }
      if (locationFilter) {
        query = query.ilike("location", `%${locationFilter}%`);
      }
      if (maxPrice < 50000) {
        query = query.lte("price", maxPrice);
      }
      if (minRating > 0) {
        query = query.gte("rating", minRating);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      
      // Score and sort results if there's a search
      if (activeSearch && data) {
        const scoreTokens = Array.from(
          new Set([
            ...tokenize(activeSearch),
            ...activeSearch
              .trim()
              .split(/\s+/)
              .map((t) => t.trim().toLowerCase())
              .filter((t) => t.length >= 2)
              .slice(0, 8),
          ])
        );
        const scored = data.map(service => ({
          ...service,
          score: scoreServiceMatch(service, activeSearch, scoreTokens)
        }));
        
        // Filter out services with very low scores, but keep some results
        const filtered = scored.filter(s => s.score > 0.1);
        
        // If no services pass the filter, return all services sorted by score
        if (filtered.length === 0) {
          return scored.sort((a, b) => b.score - a.score);
        }
        
        return filtered.sort((a, b) => b.score - a.score);
      }

      return data || [];
    },
    // Add retry and stale time to handle potential issues
    retry: 2,
    staleTime: 30000,
  });

  return (
    <div className="min-h-screen bg-background services-page-root">
      <Seo
        title="All Home Services at One Place | Book Verified Professionals"
        description="Explore all services including electrician, plumber, cleaning, AC repair, and more. Book trusted experts near you."
        canonicalPath="/services"
        keywords={["all home services", "service categories", "book services online"]}
      />
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
              {/* Show header and search only when no active search */}
              {!activeSearch ? (
                <>
                  <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-2">Browse Services</h1>
                  <p className="text-muted-foreground mb-6">Find perfect service for your needs — search in any language</p>
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
                </>
              ) : (
                /* Show search results header when search is active */
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-2">
                        Search Results
                      </h1>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Search className="w-4 h-4" />
                        <span>
                          Showing results for "{activeSearch}"
                          {services && services.length > 0 && (
                            <span className="text-emerald-600 ml-1">
                              ({services.length} service{services.length > 1 ? 's' : ''} found)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate("/services");
                        setSearchQuery("");
                        setSelectedCategory(null);
                        setLocationFilter("");
                        setMaxPrice(50000);
                        setMinRating(0);
                      }}
                    >
                      New Search
                    </Button>
                  </div>
                </div>
              )}

              {/* Filtering Section */}
              {isServiceTypeSearched ? (
                <div className="glass rounded-2xl p-3 services-filter-bar">
                  {/* Compact Filter Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>Filters ({services?.length || 0} services)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Individual Reset Buttons */}
                      {(selectedCategory || locationFilter || maxPrice < 50000 || minRating > 0) && (
                        <>
                          {selectedCategory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCategory(null)}
                              className="text-xs h-6 px-2"
                            >
                              Reset Category
                            </Button>
                          )}
                          {locationFilter && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocationFilter("")}
                              className="text-xs h-6 px-2"
                            >
                              Reset Location
                            </Button>
                          )}
                          {maxPrice < 50000 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMaxPrice(50000)}
                              className="text-xs h-6 px-2"
                            >
                              Reset Price
                            </Button>
                          )}
                          {minRating > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMinRating(0)}
                              className="text-xs h-6 px-2"
                            >
                              Reset Quality
                            </Button>
                          )}
                        </>
                      )}
                      {/* Main Clear All Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory(null);
                          setLocationFilter("");
                          setMaxPrice(50000);
                          setMinRating(0);
                        }}
                        className="text-xs h-8"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  {/* Active Filters */}
                  {(selectedCategory || locationFilter || maxPrice < 50000 || minRating > 0) && (
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      <span className="text-xs text-muted-foreground">Active:</span>
                      {selectedCategory && (
                        <span className="bg-primary/20 text-primary px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          {selectedCategory}
                          <button
                            onClick={() => setSelectedCategory(null)}
                            className="hover:bg-primary/30 rounded-full p-0.5"
                            title="Reset category"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {locationFilter && (
                        <span className="bg-accent/20 text-accent px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          📍 {locationFilter}
                          <button
                            onClick={() => setLocationFilter("")}
                            className="hover:bg-accent/30 rounded-full p-0.5"
                            title="Reset location"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {maxPrice < 50000 && (
                        <span className="bg-warning/20 text-warning px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          ≤₹{maxPrice.toLocaleString('en-IN')}
                          <button
                            onClick={() => setMaxPrice(50000)}
                            className="hover:bg-warning/30 rounded-full p-0.5"
                            title="Reset price"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {minRating > 0 && (
                        <span className="bg-emerald-20 text-emerald-600 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          {minRating === 3 ? "Good" : minRating === 4 ? "Better" : "Best"}
                          <button
                            onClick={() => setMinRating(0)}
                            className="hover:bg-emerald-30 rounded-full p-0.5"
                            title="Reset quality"
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Compact Filter Controls */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {/* Price */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">Price</label>
                      <select
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                        className="text-xs bg-secondary/30 border border-border rounded px-2 py-1 h-8"
                      >
                        <option value={50000}>Any Price</option>
                        <option value={500}>Under ₹500</option>
                        <option value={1000}>Under ₹1k</option>
                        <option value={2000}>Under ₹2k</option>
                        <option value={5000}>Under ₹5k</option>
                      </select>
                    </div>

                    {/* Quality */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">Quality</label>
                      <select
                        value={minRating}
                        onChange={(e) => setMinRating(Number(e.target.value))}
                        className="text-xs bg-secondary/30 border border-border rounded px-2 py-1 h-8"
                      >
                        <option value={0}>Any</option>
                        <option value={3}>Good ⭐⭐⭐</option>
                        <option value={4}>Better ⭐⭐⭐⭐</option>
                        <option value={5}>Best ⭐⭐⭐⭐⭐</option>
                      </select>
                    </div>

                    {/* Location */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-xs font-medium text-foreground">Location</label>
                      <Input
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        placeholder="Area or city..."
                        className="text-xs bg-secondary/30 border border-border h-8"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass rounded-2xl p-4 text-sm text-muted-foreground services-filter-bar">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>Search for a service above to see filtering options</span>
                  </div>
                </div>
              )}

              {/* Service Results */}
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="glass rounded-2xl p-6 animate-pulse h-64" />
                  ))}
                </div>
              ) : !services || services.length === 0 ? (
                <div className="text-center py-20">
                  <div className="mb-4">
                    <Search className="w-16 h-16 text-muted-foreground mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No services found</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {isServiceTypeSearched 
                      ? "Try adjusting your filters or search for different services"
                      : "Try searching for a service type like 'plumber', 'electrician', or 'AC repair'"
                    }
                  </p>
                  {/* Debug information */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-muted-foreground mt-2 p-2 bg-secondary/20 rounded">
                      <p>Debug Info:</p>
                      <p>Services: {services?.length || 0}</p>
                      <p>Active Search: {activeSearch}</p>
                      <p>Is Service Type Searched: {isServiceTypeSearched}</p>
                      <p>Selected Category: {selectedCategory}</p>
                      <p>Location: {locationFilter}</p>
                      <p>Max Price: {maxPrice}</p>
                      <p>Min Rating: {minRating}</p>
                    </div>
                  )}
                  {isServiceTypeSearched ? (
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCategory(null);
                          setLocationFilter("");
                          setMaxPrice(50000);
                          setMinRating(0);
                        }}
                        className="text-sm"
                      >
                        Clear All Filters
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          navigate("/services");
                          setSearchQuery("");
                          setSelectedCategory(null);
                          setLocationFilter("");
                          setMaxPrice(50000);
                          setMinRating(0);
                        }}
                        className="text-xs"
                      >
                        Start New Search
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Force refresh all services
                          queryClient.invalidateQueries(["services"]);
                        }}
                        className="text-xs"
                      >
                        Refresh Services
                      </Button>
                    </div>
                  ) : null}
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
                        className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
                        whileHover={{ y: -4, scale: 1.02 }}
                      >
                        <div className="flex flex-col gap-4">
                          {/* Rating Badge for High-Rated Services */}
                          {service.rating && service.rating >= 4.5 && (
                            <div className="flex justify-center">
                              <div className="bg-gradient-to-r from-warning/20 to-success/20 px-3 py-1 rounded-full border border-warning/30">
                                <span className="text-xs font-semibold text-warning flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-warning" />
                                  Top Rated
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                              {String(service.title || "SV").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground line-clamp-2">{service.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-3">{service.description}</p>
                            </div>
                            <div className="ml-auto flex flex-col items-end gap-1">
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                  <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-3 h-3 ${
                                          star <= (service.rating || 0)
                                            ? "text-warning fill-warning"
                                            : "text-muted-foreground"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm font-bold text-foreground">{service.rating || "New"}</span>
                                </div>
                                {service.review_count > 0 && (
                                  <span className="text-xs text-muted-foreground">{service.review_count} reviews</span>
                                )}
                              </div>
                              <span className="font-display font-bold text-accent flex items-center">
                                <IndianRupee className="w-3.5 h-3.5" />{service.price}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                            <span className="text-xs text-muted-foreground">
                              {service.category} • {service.location || "Remote"}
                            </span>
                            <Button variant="hero" size="sm" onClick={() => setBookingService(service)}>
                              Book Now
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
      </div>

      {bookingService && (
        <BookingModal service={bookingService} onClose={() => setBookingService(null)} />
      )}
    </div>
  );
};

export default Services;
