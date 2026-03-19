import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "@/styles/seeker-dashboard.css";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ShoppingBag, Clock, Star, IndianRupee, User, Mail, Save, X, Home, Navigation } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import LiveTrackingMap from "@/components/tracking/LiveTrackingMap";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationPermissionIfNeeded, triggerHardNotification } from "@/lib/hardNotifications";
import { registerBackgroundPushForCurrentUser } from "@/lib/pushNotifications";

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  accepted: "bg-info/20 text-info",
  on_the_way: "bg-info/20 text-info",
  arrived: "bg-info/20 text-info",
  started: "bg-info/20 text-info",
  completed: "bg-success/20 text-success",
  cancelled: "bg-destructive/20 text-destructive",
};

const paymentBadgeClass = (paymentStatus: string) => {
  if (paymentStatus === "paid") return "bg-success/20 text-success";
  if (paymentStatus === "requested") return "bg-info/20 text-info";
  if (paymentStatus === "rejected") return "bg-destructive/20 text-destructive";
  return "bg-warning/20 text-warning";
};

const paymentLabel = (paymentStatus: string) => {
  if (paymentStatus === "paid") return "Paid";
  if (paymentStatus === "requested") return "Requested";
  if (paymentStatus === "rejected") return "Rejected";
  return "Unpaid";
};

const normalizeStatus = (status: string) => {
  if (status === "confirmed") return "accepted";
  if (status === "in_progress") return "started";
  return status;
};

const statusLabel = (status: string) => normalizeStatus(status).replace(/_/g, " ");

const bookingStages = ["accepted", "on_the_way", "arrived", "started", "completed"];

const getTimelineStageIndex = (status: string) => {
  const normalized = normalizeStatus(status);
  if (normalized === "pending") return -1;
  if (normalized === "cancelled" || normalized === "disputed") return -1;
  return bookingStages.indexOf(normalized);
};

const SeekerDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [disputingBookingId, setDisputingBookingId] = useState<string | null>(null);
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const handledRealtimeAlertKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void requestNotificationPermissionIfNeeded().then((permission) => {
      if (permission === "granted") {
        void registerBackgroundPushForCurrentUser();
      }
    });
  }, [user?.id]);

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setEditName(profile.name);
      setEditLocation((profile as any).location ?? "");
      setEditAvatar(profile.avatar_url ?? "");
    }
  }, [profile]);

  const { data: bookings = [], error: bookingsError, isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      if (!user) {
        console.log("❌ No user, skipping bookings query");
        return [];
      }
      console.log("🔍 Fetching bookings for seeker:", user.id);

      // Fetch bookings without attempting to auto-join profiles (rest returns 400 if no FK exists)
      const { data, error } = await supabase
        .from("bookings")
        .select("*, services(title)")
        .eq("seeker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Bookings query error:", error);
        throw error;
      }

      const rows = data ?? [];
      console.log("✅ Bookings fetched:", rows.length, "bookings", rows);

      // Enrich each booking with provider profile (profiles table is keyed by id)
      const enriched = await Promise.all(rows.map(async (b: any) => {
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, is_available")
            .eq("id", b.provider_id)
            .maybeSingle();
          return { ...b, profiles: profileData ?? null };
        } catch (e) {
          return { ...b, profiles: null };
        }
      }));

      return enriched;
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Reviews: track which bookings the seeker has already reviewed
  const { data: myReviews = [] } = useQuery({
    queryKey: ["my-reviews", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("seeker_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });
  const reviewedSet = new Set((myReviews as any[]).map((r) => r.booking_id));

  // Log any errors
  useEffect(() => {
    if (bookingsError) {
      console.error("📍 Bookings error in component:", bookingsError);
      toast({ 
        title: "Error loading orders", 
        description: bookingsError.message, 
        variant: "destructive" 
      });
    }
  }, [bookingsError]);

  useEffect(() => {
    if (!loading && user) {
      console.log("👤 User loaded:", user.id);
      // Force initial fetch of bookings
      queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
    }
  }, [user?.id, loading, queryClient]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bookings-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `seeker_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log("📲 Booking updated for seeker:", payload);
          if (payload.eventType === "UPDATE") {
            const previousStatus = normalizeStatus(payload.old?.status || "");
            const nextStatus = normalizeStatus(payload.new?.status || "");
            const previousPayment = payload.old?.payment_status || "unpaid";
            const nextPayment = payload.new?.payment_status || "unpaid";

            if (previousStatus && nextStatus && previousStatus !== nextStatus) {
              toast({
                title: "Booking status updated",
                description: `Your booking is now ${statusLabel(nextStatus)}.`,
              });

              if (["accepted", "on_the_way"].includes(nextStatus)) {
                const statusAlertKey = `${payload.new?.id}:${nextStatus}`;
                if (!handledRealtimeAlertKeysRef.current.has(statusAlertKey)) {
                  handledRealtimeAlertKeysRef.current.add(statusAlertKey);
                  void triggerHardNotification({
                    title: nextStatus === "accepted" ? "Provider accepted your booking" : "Provider is on the way",
                    body:
                      nextStatus === "accepted"
                        ? "Your booking has been accepted. Open dashboard for live progress."
                        : "Your provider started travel. Check live tracking now.",
                    tag: `seeker-booking-status-${payload.new?.id}-${nextStatus}`,
                    requireInteraction: true,
                  });
                }
              }
            }

            if (previousPayment !== nextPayment && nextPayment === "requested") {
              const paymentAlertKey = `${payload.new?.id}:payment-requested`;
              if (!handledRealtimeAlertKeysRef.current.has(paymentAlertKey)) {
                handledRealtimeAlertKeysRef.current.add(paymentAlertKey);
                toast({
                  title: "Payment requested",
                  description: "Your provider requested payment confirmation.",
                });
                void triggerHardNotification({
                  title: "Payment requested",
                  body: "Provider requested payment. Open dashboard to confirm or reject.",
                  tag: `seeker-payment-request-${payload.new?.id}`,
                  requireInteraction: true,
                });
              }
            }
          }
          queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
        }
      )
      .subscribe((status) => {
        console.log("📡 Bookings subscription status:", status);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Realtime: reflect profile/availability changes (name, location, provider online)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("profiles-seeker-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        const changedId = (payload.new as any)?.id;
        if (!changedId) return;
        if (changedId === user.id) {
          queryClient.invalidateQueries({ queryKey: ["seeker-profile", user.id] });
        }
        queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ name: editName, location: editLocation, avatar_url: editAvatar } as any)
      .eq("id", user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Profile updated" });
      setShowEditProfile(false);
      queryClient.invalidateQueries({ queryKey: ["seeker-profile"] });
    }
  };

  const cancelBooking = async (bookingId: string, status: string) => {
    const normalizedStatus = normalizeStatus(status);
    if (!["pending", "accepted"].includes(normalizedStatus)) {
      toast({
        title: "Cannot cancel",
        description: "Only pending or accepted bookings can be cancelled.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;
    setCancellingBookingId(bookingId);

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("seeker_id", user.id);

    setCancellingBookingId(null);

    if (error) {
      toast({
        title: "Cancellation failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking cancelled",
      description: "Your booking was cancelled successfully.",
    });
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
  };

  const raiseDispute = async (bookingId: string, status: string) => {
    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus !== "started") {
      toast({
        title: "Cannot dispute",
        description: "A dispute can be raised only after service has started.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;
    setDisputingBookingId(bookingId);

    const { error } = await supabase
      .from("bookings")
      .update({ status: "disputed" })
      .eq("id", bookingId)
      .eq("seeker_id", user.id);

    setDisputingBookingId(null);

    if (error) {
      toast({
        title: "Dispute failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Dispute raised",
      description: "Admin will review your booking dispute.",
    });
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
  };

  const requestPayment = async (bookingId: string, status: string, method: string) => {
    const normalizedStatus = normalizeStatus(status);
    if (!["started", "arrived"].includes(normalizedStatus)) {
      toast({
        title: "Payment not available",
        description: "You can pay once provider has arrived or started service.",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;
    setPayingBookingId(bookingId);

    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "requested", payment_method: method } as any)
      .eq("id", bookingId)
      .eq("seeker_id", user.id);

    setPayingBookingId(null);

    if (error) {
      toast({ title: "Payment update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Payment requested", description: "Provider will now confirm payment receipt." });
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user.id] });
  };

  const submitReview = async () => {
    if (!reviewingBookingId || !user) return;
    const booking = bookings.find((b: any) => b.id === reviewingBookingId);
    if (!booking) return;
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: reviewingBookingId,
      seeker_id: user.id,
      provider_id: booking.provider_id,
      service_id: booking.service_id,
      rating: reviewRating,
      comment: reviewComment || null,
    } as any);
    setSubmittingReview(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Review submitted!", description: "Thank you for your feedback." });
    setReviewingBookingId(null);
    setReviewRating(5);
    setReviewComment("");
    queryClient.invalidateQueries({ queryKey: ["my-reviews", user.id] });
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground">Loading...</span></div>;

  const active = bookings.filter((b: any) => ["pending", "accepted", "on_the_way", "arrived", "started"].includes(normalizeStatus(b.status))).length;
  const completed = bookings.filter((b: any) => b.status === "completed").length;
  const totalSpent = bookings.filter((b: any) => b.status === "completed").reduce((s: number, b: any) => s + Number(b.amount), 0);

  // Debug logging
  console.log("📊 Seeker Dashboard State:", {
    userId: user?.id,
    totalBookings: bookings.length,
    activeCount: active,
    completedCount: completed,
    bookingsData: bookings,
    isLoading: bookingsLoading,
    error: bookingsError,
  });

  return (
    <div className="min-h-screen bg-background seeker-dashboard-root">
      <Navbar />
      <div className="container px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-display text-foreground">Welcome back{profile?.name ? `, ${profile.name}` : ""}</h1>
              <p className="text-muted-foreground mt-1">What service do you need today?</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => navigate("/")}>
                <Home className="w-4 h-4 mr-1" /> Back to Home
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setShowEditProfile(true)}>
                <User className="w-4 h-4 mr-1" /> Edit Profile
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Active Orders", value: String(active), icon: ShoppingBag },
              { label: "Completed", value: String(completed), icon: Clock },
              { label: "Total Orders", value: String(bookings.length), icon: Star },
              { label: "Total Spent", value: `₹${totalSpent.toLocaleString("en-IN")}`, icon: IndianRupee },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="glass glass-hover rounded-2xl p-5">
                  <Icon className="w-5 h-5 text-accent mb-3" />
                  <div className="text-2xl font-bold font-display text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>

          <div className="glass rounded-2xl p-2 mb-8 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input type="text" placeholder="Search for a service..." className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground py-3" />
            </div>
            <Button variant="hero" size="lg" className="rounded-xl" onClick={() => navigate("/services")}>Browse</Button>
          </div>

          <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-foreground">Recent Orders</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  console.log("🔄 Manual refresh triggered");
                  queryClient.invalidateQueries({ queryKey: ["my-bookings", user?.id] });
                }}
              >
                🔄 Refresh
              </Button>
            </div>

            {bookingsLoading && <p className="text-muted-foreground text-center py-4">Loading orders...</p>}
            
            {bookingsError && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 mb-4">
                <p className="text-sm text-destructive">
                  <strong>Error:</strong> {(bookingsError as any)?.message || "Failed to load orders"}
                </p>
              </div>
            )}

            {/* Debug panel removed for better UX (was shown only in development) */}

            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No orders yet. Browse services to get started!</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((order: any) => {
                  const normalizedStatus = normalizeStatus(order.status);
                  const stageIndex = getTimelineStageIndex(order.status);
                  const isLiveTracking = normalizedStatus === "on_the_way";
                  return (
                  <div key={order.id} className="rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {(order.services as any)?.title || "Service"}
                          {(order.profiles as any)?.is_available && (
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse" title="Provider Online" />
                          )}
                          {isLiveTracking && (
                            <span className="flex items-center gap-1 text-xs text-accent font-medium animate-pulse">
                              <Navigation className="w-3 h-3" /> Live
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{(order.profiles as any)?.name || "Provider"} · {new Date(order.created_at).toLocaleDateString()}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {bookingStages.map((stage, idx) => {
                            const isDone = stageIndex >= idx;
                            return (
                              <span
                                key={`${order.id}-${stage}`}
                                className={`text-[10px] px-2 py-1 rounded-full border uppercase tracking-wide ${
                                  isDone
                                    ? "bg-accent/20 border-accent/40 text-foreground"
                                    : "bg-background/50 border-border text-muted-foreground"
                                }`}
                              >
                                {stage.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${statusColors[normalizedStatus] || ""}`}>
                          {statusLabel(normalizedStatus)}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${paymentBadgeClass(order.payment_status || "unpaid")}`}>
                          Payment: {paymentLabel(order.payment_status || "unpaid")}
                        </span>
                        {(normalizedStatus === "pending" || normalizedStatus === "accepted") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={cancellingBookingId === order.id}
                            onClick={() => cancelBooking(order.id, order.status)}
                          >
                            {cancellingBookingId === order.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        )}
                        {normalizedStatus === "started" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/40 hover:text-destructive"
                            disabled={disputingBookingId === order.id}
                            onClick={() => raiseDispute(order.id, order.status)}
                          >
                            {disputingBookingId === order.id ? "Submitting..." : "Raise Dispute"}
                          </Button>
                        )}
                        {(order.payment_status === "unpaid" || order.payment_status === "rejected" || !order.payment_status) && (normalizedStatus === "arrived" || normalizedStatus === "started") && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="hero"
                              disabled={payingBookingId === order.id}
                              onClick={() => requestPayment(order.id, order.status, "upi")}
                            >
                              {payingBookingId === order.id ? "Processing..." : "Pay by UPI"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={payingBookingId === order.id}
                              onClick={() => requestPayment(order.id, order.status, "cash")}
                            >
                              Cash
                            </Button>
                          </div>
                        )}
                        {normalizedStatus === "completed" && !reviewedSet.has(order.id) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-accent/40 text-accent hover:text-accent"
                            onClick={() => { setReviewingBookingId(order.id); setReviewRating(5); setReviewComment(""); }}
                          >
                            <Star className="w-3 h-3 mr-1" /> Review
                          </Button>
                        )}
                        {normalizedStatus === "completed" && reviewedSet.has(order.id) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Reviewed
                          </span>
                        )}
                        <span className="font-display font-semibold text-foreground">₹{order.amount}</span>
                      </div>
                    </div>
                    {isLiveTracking && (
                      <div className="px-4 pb-4">
                        <LiveTrackingMap
                          bookingId={order.id}
                          destinationLat={order.booking_location_latitude ?? null}
                          destinationLng={order.booking_location_longitude ?? null}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Edit Profile Modal */}
          {showEditProfile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowEditProfile(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-8 w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setShowEditProfile(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold font-display text-foreground mb-6">Edit Profile</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">Name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="pl-10 bg-secondary/50 border-border" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-foreground">Email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={profile?.email ?? ""} disabled className="pl-10 bg-secondary/30 border-border text-muted-foreground" />
                    </div>
                  </div>
                <div>
                  <Label className="text-foreground">Location</Label>
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="bg-secondary/50 border-border mt-1"
                    placeholder="City / Area"
                  />
                </div>
                <div>
                  <Label className="text-foreground">Photo URL</Label>
                  <Input
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="bg-secondary/50 border-border mt-1"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste an image URL for your profile photo (storage upload can be added later).
                  </p>
                </div>
                </div>
                <Button variant="hero" className="w-full rounded-xl h-11 mt-6" onClick={saveProfile}>
                  <Save className="w-4 h-4 mr-1" /> Save Changes
                </Button>
              </motion.div>
            </div>
          )}

          {/* Review Modal */}
          {reviewingBookingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setReviewingBookingId(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-8 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setReviewingBookingId(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold font-display text-foreground mb-2">Leave a Review</h2>
                <p className="text-sm text-muted-foreground mb-6">How was your experience with this service?</p>

                {/* Star rating */}
                <div className="flex items-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-9 h-9 transition-colors ${star <= reviewRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                      />
                    </button>
                  ))}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][reviewRating]}
                  </span>
                </div>

                <div className="mb-6">
                  <Label className="text-foreground">Comment (optional)</Label>
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="bg-secondary/50 border-border mt-1 resize-none"
                    placeholder="Share your experience with this provider..."
                    rows={3}
                  />
                </div>

                <Button
                  variant="hero"
                  className="w-full rounded-xl h-11"
                  disabled={submittingReview}
                  onClick={submitReview}
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </Button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SeekerDashboard;
