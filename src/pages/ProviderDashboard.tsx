import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import "@/styles/provider-dashboard.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IndianRupee, CheckCircle, Clock, Plus, X, Package, ToggleLeft, ToggleRight,
  User, Mail, Save, Home, Star, HelpCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { serviceCategories } from "@/data/marketplace";
import ProviderNavigationMap from "@/components/tracking/ProviderNavigationMap";
import { getNotificationPermissionState, requestNotificationPermissionIfNeeded, triggerHardNotification } from "@/lib/hardNotifications";
import { getSubscriptionStatus, registerBackgroundPushForCurrentUser } from "@/lib/pushNotifications";
import RealtimeNotificationBell from "@/components/notifications/RealtimeNotificationBell";
import { usePersistentNotifications } from "@/hooks/usePersistentNotifications";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const normalizeStatus = (status: string) => {
  if (status === "confirmed") return "accepted";
  if (status === "in_progress") return "started";
  return status;
};

const statusLabel = (status: string) => normalizeStatus(status).replace(/_/g, " ");

const statusBadgeClass = (status: string) => {
  const normalized = normalizeStatus(status);
  if (normalized === "completed") return "bg-success/20 text-success";
  if (normalized === "cancelled") return "bg-destructive/20 text-destructive";
  if (normalized === "pending") return "bg-warning/20 text-warning";
  return "bg-info/20 text-info";
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

const nextStatusLabel: Record<string, string> = {
  on_the_way: "Mark On The Way",
  arrived: "Mark Arrived",
  started: "Start Service",
  completed: "Mark Completed",
};

const lifecycleSteps = ["accepted", "on_the_way", "arrived", "started", "completed"];

const canMoveToStatus = (currentStatus: string, targetStatus: string) => {
  const normalized = normalizeStatus(currentStatus);
  const currentIndex = lifecycleSteps.indexOf(normalized);
  const targetIndex = lifecycleSteps.indexOf(targetStatus);
  return currentIndex >= 0 && targetIndex === currentIndex + 1;
};

type UrgentProviderAlert = {
  bookingId: string;
  amount: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  createdAt: string;
};

const ProviderDashboard = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAddService, setShowAddService] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayBookingId, setDelayBookingId] = useState<string | null>(null);
  const [delayDate, setDelayDate] = useState<string>("");
  const [delayTime, setDelayTime] = useState<string>("");
  const [delayMessage, setDelayMessage] = useState<string>("");
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [paymentUpdatingBookingId, setPaymentUpdatingBookingId] = useState<string | null>(null);
  const [urgentAlerts, setUrgentAlerts] = useState<UrgentProviderAlert[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [newService, setNewService] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    location: "",
  });
  const [editName, setEditName] = useState("");
  const locationWatchRef = useRef<number | null>(null);
  const alertedBookingIdsRef = useRef<Set<string>>(new Set());
  const { unreadNotifications, unreadCount, markRead, markAllRead } = usePersistentNotifications(user?.id);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    const refreshNotificationUi = async () => {
      const permission = getNotificationPermissionState();
      setNotificationPermission(permission);

      try {
        const status = await getSubscriptionStatus();
        setPushEnabled(Boolean(status.supported && status.isSubscribed));
      } catch {
        setPushEnabled(false);
      }
    };

    void refreshNotificationUi();

    const onFocus = () => {
      void refreshNotificationUi();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user?.id]);

  // Cleanup GPS watch on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  const startLocationBroadcast = (bookingId: string) => {
    if (!navigator.geolocation || !user) return;
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
    locationWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading } = position.coords;
        await supabase.from("provider_locations" as any).upsert({
          provider_id: user.id,
          booking_id: bookingId,
          latitude,
          longitude,
          heading: heading ?? null,
          updated_at: new Date().toISOString(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopLocationBroadcast = () => {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  };

  // Realtime: listen for service approval changes and booking updates
  useEffect(() => {
    if (!user) return;
    
    const ch1 = supabase.channel(`provider-services-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "services", filter: `provider_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["provider-services", user.id] });
      })
      .subscribe();
    
    const ch2 = supabase.channel(`provider-bookings-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `provider_id=eq.${user.id}` }, (payload: any) => {
        if (payload.eventType === "INSERT") {
          const bookingId = payload.new?.id as string | undefined;
          if (bookingId && !alertedBookingIdsRef.current.has(bookingId)) {
            alertedBookingIdsRef.current.add(bookingId);
            const newAlert: UrgentProviderAlert = {
              bookingId,
              amount: Number(payload.new?.amount ?? 0),
              scheduledDate: payload.new?.scheduled_date ?? null,
              scheduledTime: payload.new?.scheduled_time ?? null,
              createdAt: payload.new?.created_at ?? new Date().toISOString(),
            };
            setUrgentAlerts((prev) => [newAlert, ...prev].slice(0, 5));

            void triggerHardNotification({
              title: "New service hit",
              body: `Booking request received${newAlert.scheduledTime ? ` for ${newAlert.scheduledTime}` : ""}. Open Provider Hub now.`,
              tag: `provider-booking-${bookingId}`,
              requireInteraction: true,
            });
          }

          toast({
            title: "New booking request",
            description: "A seeker has requested your service.",
          });
        }
        if (payload.eventType === "UPDATE") {
          const previousStatus = normalizeStatus(payload.old?.status || "");
          const nextStatus = normalizeStatus(payload.new?.status || "");
          if (previousStatus && nextStatus && previousStatus !== nextStatus) {
            toast({
              title: "Booking status updated",
              description: `Booking moved to ${statusLabel(nextStatus)}.`,
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["provider-bookings", user.id] });
      })
      .subscribe();
    
    const ch3 = supabase.channel(`provider-reviews-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `provider_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            (q.queryKey[0] === "provider-services" || q.queryKey[0] === "provider-bookings" || q.queryKey[0] === "services"),
        });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [user?.id, queryClient, toast]);

  const dismissUrgentAlert = (bookingId: string) => {
    setUrgentAlerts((prev) => prev.filter((alert) => alert.bookingId !== bookingId));
  };

  const dismissAllUrgentAlerts = () => {
    setUrgentAlerts([]);
  };

  const enableNotifications = async () => {
    const permission = await requestNotificationPermissionIfNeeded();
    setNotificationPermission(permission as "default" | "granted" | "denied" | "unsupported");

    if (permission === "granted") {
      await registerBackgroundPushForCurrentUser();
      try {
        const status = await getSubscriptionStatus();
        setPushEnabled(Boolean(status.supported && status.isSubscribed));
      } catch {
        setPushEnabled(false);
      }
      toast({
        title: "Notifications enabled",
        description: "You will now receive hard alerts for incoming service requests.",
      });
      return;
    }

    if (permission === "denied") {
      toast({
        title: "Notifications blocked",
        description: "Enable notifications in your browser site settings, then return and click Check again.",
        variant: "destructive",
      });
    }
  };

  const checkNotificationPermission = async () => {
    const permission = getNotificationPermissionState();
    setNotificationPermission(permission);
    if (permission === "granted") {
      await registerBackgroundPushForCurrentUser();
      try {
        const status = await getSubscriptionStatus();
        setPushEnabled(Boolean(status.supported && status.isSubscribed));
      } catch {
        setPushEnabled(false);
      }
      toast({
        title: "Notifications active",
        description: "Hard alerts are now available in this tab.",
      });
      return;
    }

    setPushEnabled(false);
  };

  const { data: profile } = useQuery({
    queryKey: ["provider-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) setEditName(profile.name);
  }, [profile]);

  const { data: services = [] } = useQuery({
    queryKey: ["provider-services", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*").eq("provider_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["provider-bookings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, services:service_id (title)")
        .eq("provider_id", user!.id)
        .order("created_at", { ascending: false });
      // Fetch seeker names separately
      const enriched = await Promise.all((data ?? []).map(async (b: any) => {
        const { data: seekerData } = await supabase.from("profiles").select("name").eq("id", b.seeker_id).single();
        return { ...b, seeker_name: seekerData?.name || "Customer" };
      }));
      return enriched;
    },
    enabled: !!user,
  });

  const { data: serviceReviews = [] } = useQuery({
    queryKey: ["provider-service-reviews", user?.id],
    queryFn: async () => {
      const { data: reviewsData, error } = await supabase
        .from("reviews")
        .select("id, booking_id, service_id, seeker_id, rating, comment, created_at")
        .eq("provider_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      const reviews = reviewsData ?? [];
      const seekerIds = Array.from(new Set(reviews.map((r: any) => r.seeker_id).filter(Boolean)));

      let seekerNameById = new Map<string, string>();
      if (seekerIds.length > 0) {
        const { data: seekers } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", seekerIds);
        seekerNameById = new Map((seekers ?? []).map((s: any) => [String(s.id), String(s.name || "Customer")]));
      }

      return reviews.map((r: any) => ({
        ...r,
        seeker_name: seekerNameById.get(String(r.seeker_id)) || "Customer",
      }));
    },
    enabled: !!user,
  });

  const reviewByBookingId = new Map(
    (serviceReviews as any[])
      .filter((r: any) => r.booking_id)
      .map((r: any) => [String(r.booking_id), r])
  );

  const completedCount = bookings.filter((b: any) => b.status === "completed").length;
  const totalEarnings = bookings
    .filter((b: any) => b.status === "completed")
    .reduce((sum: number, b: any) => sum + Number(b.provider_earnings ?? Number(b.amount) * 0.85), 0);
  const pendingCount = bookings.filter((b: any) => b.status === "pending").length;
  const totalRatings = services.reduce((sum: number, s: any) => sum + Number(s.review_count || 0), 0);
  const weightedRatingSum = services.reduce(
    (sum: number, s: any) => sum + Number(s.rating || 0) * Number(s.review_count || 0),
    0
  );
  const averageProviderRating = totalRatings > 0 ? weightedRatingSum / totalRatings : 0;

  const toggleAvailability = async () => {
    if (!user) return;
    const newVal = !(profile as any)?.is_available;
    const { error } = await supabase
      .from("profiles")
      .update({ is_available: newVal } as any)
      .eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "services" });
    queryClient.invalidateQueries({ queryKey: ["category-counts"] });
    queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
    toast({
      title: newVal ? "You are online" : "You are offline",
      description: newVal
        ? "Your approved active services are now visible to seekers."
        : "Your services are now hidden from seekers.",
    });
  };

  const updateBooking = async (id: string, status: string) => {
    // Build update payload (include commission fields when completing)
    const updateData: Record<string, any> = { status };
    if (status === "completed") {
      const prevData = queryClient.getQueryData<any[]>(["provider-bookings", user?.id]) ?? [];
      const booking = prevData.find((b: any) => b.id === id);
      if (booking) {
        updateData.provider_earnings = parseFloat((Number(booking.amount) * 0.85).toFixed(2));
        updateData.platform_earnings = parseFloat((Number(booking.amount) * 0.15).toFixed(2));
        updateData.commission_rate = 15.00;
      }
    }

    // Optimistic update: update cache immediately for snappy UI
    const providerKey = ["provider-bookings", user?.id];
    const previousProvider = queryClient.getQueryData<any[]>(providerKey);
    const shouldStartTracking = status === "on_the_way";
    setUpdatingBookingId(id);

    // Start GPS tracking immediately for responsive UX when provider marks on_the_way.
    if (shouldStartTracking) {
      startLocationBroadcast(id);
    }

    try {
      // locally update provider-bookings cache
      queryClient.setQueryData(providerKey, (old: any[] | undefined) =>
        (old || []).map((r) => (r.id === id ? { ...r, ...updateData } : r))
      );

      // also update any my-bookings queries for seekers (best-effort)
      const myBookingsQueries = queryClient.getQueryCache().findAll({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "my-bookings" });
      myBookingsQueries.forEach((q) => {
        queryClient.setQueryData(q.queryKey as any, (old: any[] | undefined) =>
          (old || []).map((r) => (r.id === id ? { ...r, ...updateData } : r))
        );
      });

      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", id)
        .eq("provider_id", user?.id as string);
      if (error) throw error;

      // GPS tracking lifecycle
      if (["arrived", "started", "completed", "cancelled"].includes(status)) {
        stopLocationBroadcast();
      }

      // Invalidate to ensure server canonical state
      await queryClient.invalidateQueries({ queryKey: ["provider-bookings", user?.id] });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "my-bookings" });

      toast({ title: `Booking ${status.replace(/_/g, " ")}`, description: "Updated successfully" });
    } catch (err: any) {
      // rollback
      if (previousProvider) queryClient.setQueryData(providerKey, previousProvider);
      if (shouldStartTracking) {
        stopLocationBroadcast();
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const respondPaymentRequest = async (booking: any, accept: boolean) => {
    if (!user) return;
    setPaymentUpdatingBookingId(booking.id);

    const payload: Record<string, any> = {
      payment_status: accept ? "paid" : "rejected",
    };

    if (accept) {
      const commissionRate = 15;
      const platform = parseFloat((Number(booking.amount) * (commissionRate / 100)).toFixed(2));
      payload.commission_rate = commissionRate;
      payload.platform_earnings = platform;
      payload.provider_earnings = parseFloat((Number(booking.amount) - platform).toFixed(2));
    }

    const { error } = await supabase
      .from("bookings")
      .update(payload)
      .eq("id", booking.id)
      .eq("provider_id", user.id);

    setPaymentUpdatingBookingId(null);

    if (error) {
      toast({ title: "Payment update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: accept ? "Payment accepted" : "Payment rejected",
      description: accept
        ? "Payment confirmed. You can complete after finishing service."
        : "Seeker can retry payment request.",
    });

    await queryClient.invalidateQueries({ queryKey: ["provider-bookings", user.id] });
    queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "my-bookings" });
    queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
  };

  // Extended update: allow additional fields (notes, scheduled_date, scheduled_time)
  const updateBookingExtended = async (id: string, payload: Record<string, any>) => {
    // Optimistic update for status and scheduling fields
    const providerKey = ["provider-bookings", user?.id];
    const previousProvider = queryClient.getQueryData<any[]>(providerKey);
    try {
      queryClient.setQueryData(providerKey, (old: any[] | undefined) =>
        (old || []).map((r) => (r.id === id ? { ...r, ...payload } : r))
      );

      const myBookingsQueries = queryClient.getQueryCache().findAll({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "my-bookings" });
      myBookingsQueries.forEach((q) => {
        queryClient.setQueryData(q.queryKey as any, (old: any[] | undefined) =>
          (old || []).map((r) => (r.id === id ? { ...r, ...payload } : r))
        );
      });

      const { error } = await supabase.from("bookings").update(payload).eq("id", id);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["provider-bookings", user?.id] });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "my-bookings" });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "admin-bookings" });

      toast({ title: "Booking updated", description: "Status updated successfully" });
    } catch (err: any) {
      if (previousProvider) queryClient.setQueryData(providerKey, previousProvider);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const addServiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("services").insert({
        provider_id: user!.id,
        title: newService.title,
        description: newService.description,
        category: newService.category,
        price: Number(newService.price),
        location: newService.location,
        approval_status: "pending",
        is_active: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Service submitted", description: "Sent to admin for approval." });
      setShowAddService(false);
      setNewService({ title: "", description: "", category: "", price: "", location: "" });
      queryClient.invalidateQueries({ queryKey: ["provider-services"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleService = async (id: string, currentActive: boolean) => {
    await supabase.from("services").update({ is_active: !currentActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["provider-services"] });
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name: editName }).eq("id", user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Profile updated" });
      setShowEditProfile(false);
      queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
    }
  };

  const isAvailable = (profile as any)?.is_available ?? true;

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground">Loading...</span></div>;

  return (
    <div className="min-h-screen bg-background provider-dashboard-root">
      <Navbar />
      <div className="container px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground md:text-3xl">Provider Hub</h1>
              <p className="text-muted-foreground mt-1">Manage your services and earnings</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end md:gap-3">
              <RealtimeNotificationBell
                items={unreadNotifications.map((item) => ({
                  id: item.id,
                  title: item.title,
                  body: item.body,
                  createdAt: item.created_at,
                }))}
                unreadCount={unreadCount}
                onDismiss={markRead}
                onClearAll={markAllRead}
                onViewAll={() => navigate("/notifications")}
              />
              <Button variant="outline" size="sm" className="flex-1 rounded-lg sm:flex-none" onClick={() => navigate("/")}>
                <Home className="w-4 h-4 mr-1" /> Back to Home
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 rounded-lg sm:flex-none" onClick={() => navigate("/support")}>
                <HelpCircle className="w-4 h-4 mr-1" /> Support
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 rounded-lg sm:flex-none" onClick={() => setShowEditProfile(true)}>
                <User className="w-4 h-4 mr-1" /> Edit Profile
              </Button>
              <button
                onClick={toggleAvailability}
                className={`w-full rounded-xl px-4 py-2 flex items-center justify-center gap-2 cursor-pointer transition-all border sm:w-auto ${
                  isAvailable
                    ? "bg-emerald-500/15 border-emerald-400/70 text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                    : "glass hover:border-accent/30"
                }`}
              >
                {isAvailable ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-medium text-emerald-200">Online</span>
                    <ToggleRight className="w-5 h-5 text-emerald-300" />
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-medium">Offline</span>
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  </>
                )}
              </button>
            </div>
          </div>

          {!pushEnabled && (
            <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Enable notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {notificationPermission === "denied"
                      ? "Browser notifications are blocked. Allow them in site settings, then click Check again."
                      : notificationPermission === "unsupported"
                        ? "System notifications are currently disabled in this environment."
                        : "Turn on notifications to receive booking alerts."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notificationPermission !== "unsupported" && notificationPermission !== "denied" && (
                    <Button variant="hero" size="sm" onClick={enableNotifications}>Enable notifications</Button>
                  )}
                  {notificationPermission !== "unsupported" && (
                    <Button variant="outline" size="sm" onClick={checkNotificationPermission}>Check again</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {urgentAlerts.length > 0 && (
            <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-destructive/90">High Priority</p>
                  <h3 className="text-lg font-semibold text-foreground">New service request requires action</h3>
                  <p className="text-sm text-muted-foreground">Hard alert triggered for {urgentAlerts.length} incoming booking{urgentAlerts.length > 1 ? "s" : ""}.</p>
                </div>
                <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={dismissAllUrgentAlerts}>
                  Dismiss all
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {urgentAlerts.map((alert) => (
                  <div key={alert.bookingId} className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-background/60 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Booking #{alert.bookingId.slice(0, 8)}</p>
                      <p className="text-muted-foreground">
                        ₹{alert.amount} {alert.scheduledDate ? `• ${alert.scheduledDate}` : ""} {alert.scheduledTime ? `• ${alert.scheduledTime}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="hero" onClick={() => dismissUrgentAlert(alert.bookingId)}>
                        Mark seen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: "Total Earnings", value: `₹${totalEarnings.toLocaleString("en-IN")}`, icon: IndianRupee },
              { label: "Completed Jobs", value: String(completedCount), icon: CheckCircle },
              { label: "Active Services", value: String(services.filter((s: any) => s.is_active && s.approval_status === "approved").length), icon: Package },
              { label: "Pending Bookings", value: String(pendingCount), icon: Clock },
              {
                label: "Avg Rating",
                value: totalRatings > 0 ? `${averageProviderRating.toFixed(1)}★` : "New",
                icon: Star,
              },
              {
                label: "Total Ratings",
                value: String(totalRatings),
                icon: Star,
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="glass glass-hover rounded-2xl p-5">
                  <Icon className={`w-5 h-5 mb-3 ${stat.label.toLowerCase().includes("rating") ? "text-yellow-400" : "text-accent"}`} />
                  <div className="text-2xl font-bold font-display text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Incoming bookings */}
          <div className="glass rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-display font-semibold text-foreground mb-6">Incoming Jobs</h2>
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bookings yet</p>
            ) : (
              <div className="space-y-4">
                {bookings.slice(0, 10).map((b: any) => (
                  <div key={b.id} className="rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors overflow-hidden">
                    <div className="flex items-center justify-between p-4 gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{(b.services as any)?.title || "Service"}</div>
                        <div className="text-sm text-muted-foreground">
                          {b.seeker_name || "Customer"} · {b.scheduled_date || "No date"}
                        </div>
                        {normalizeStatus(b.status) === "on_the_way" ? (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            📍 {(b as any).booking_address || "Destination selected"}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-1">
                            {normalizeStatus(b.status) === "accepted"
                              ? "Click Mark On The Way to start live navigation"
                              : "Location tracking hidden"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <span className="font-display font-semibold text-foreground">₹{b.amount}</span>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${paymentBadgeClass(b.payment_status || "unpaid")}`}>
                          Payment: {paymentLabel(b.payment_status || "unpaid")}
                        </span>
                        {(b.payment_status || "unpaid") === "requested" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="hero"
                              disabled={paymentUpdatingBookingId === b.id}
                              onClick={() => respondPaymentRequest(b, true)}
                            >
                              {paymentUpdatingBookingId === b.id ? "Updating..." : "Accept Payment"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={paymentUpdatingBookingId === b.id}
                              onClick={() => respondPaymentRequest(b, false)}
                            >
                              Reject Payment
                            </Button>
                          </div>
                        )}
                        {normalizeStatus(b.status) === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              variant="hero"
                              size="sm"
                              className="rounded-lg"
                              disabled={updatingBookingId === b.id}
                              onClick={() => updateBooking(b.id, "accepted")}
                            >
                              {updatingBookingId === b.id ? "Updating..." : "Accept"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-lg text-destructive"
                              disabled={updatingBookingId === b.id}
                              onClick={() => updateBooking(b.id, "cancelled")}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusBadgeClass(b.status)}`}>
                              {normalizeStatus(b.status).replace(/_/g, " ")}
                            </span>
                            {normalizeStatus(b.status) === "completed" && (() => {
                              const review = reviewByBookingId.get(String(b.id));
                              if (!review) {
                                return (
                                  <span className="text-xs text-muted-foreground">Not rated yet</span>
                                );
                              }
                              const rating = Math.max(1, Math.min(5, Number(review.rating || 0)));
                              return (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="text-foreground/90">{review.seeker_name}</span>
                                  <span className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={`${b.id}-booking-review-${star}`}
                                        className={`w-3 h-3 ${star <= rating ? "text-yellow-400" : "text-muted-foreground"}`}
                                        fill={star <= rating ? "currentColor" : "none"}
                                      />
                                    ))}
                                  </span>
                                  <span>{rating.toFixed(1)}★</span>
                                </span>
                              );
                            })()}
                            {normalizeStatus(b.status) !== "completed" && normalizeStatus(b.status) !== "cancelled" && (
                              <div className="flex gap-2 flex-wrap justify-end">
                                {lifecycleSteps.slice(1).map((targetStatus) => (
                                  <Button
                                    key={`${b.id}-${targetStatus}`}
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      updatingBookingId === b.id ||
                                      !canMoveToStatus(b.status, targetStatus) ||
                                      (targetStatus === "completed" && b.payment_status !== "paid")
                                    }
                                    title={targetStatus === "completed" && b.payment_status !== "paid" ? "Waiting for seeker payment" : undefined}
                                    onClick={() => updateBooking(b.id, targetStatus)}
                                  >
                                    {nextStatusLabel[targetStatus]}
                                  </Button>
                                ))}
                                <Button size="sm" variant="ghost" onClick={() => { setDelayBookingId(b.id); setShowDelayModal(true); }}>Delay</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {normalizeStatus(b.status) === "on_the_way" &&
                      (b as any).booking_location_latitude &&
                      (b as any).booking_location_longitude && (
                        <div className="px-4 pb-4">
                          <ProviderNavigationMap
                            destinationLat={Number((b as any).booking_location_latitude)}
                            destinationLng={Number((b as any).booking_location_longitude)}
                            destinationAddress={(b as any).booking_address}
                          />
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Services */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-foreground">My Services</h2>
              <Button variant="hero" size="sm" className="rounded-lg" onClick={() => setShowAddService(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Service
              </Button>
            </div>
            {services.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No services yet. Add your first service!</p>
            ) : (
              <div className="space-y-3">
                {services.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{s.title}</div>
                      <div className="text-sm text-muted-foreground">{s.category} · ₹{s.price}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                        <span>
                          {Number(s.review_count || 0) > 0 ? `${Number(s.rating || 0).toFixed(1)}★` : "New"}
                          {` (${Number(s.review_count || 0)} rating${Number(s.review_count || 0) === 1 ? "" : "s"})`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        s.approval_status === "approved" ? "bg-success/20 text-success" :
                        s.approval_status === "pending" ? "bg-warning/20 text-warning" :
                        "bg-destructive/20 text-destructive"
                      }`}>{s.approval_status}</span>
                      {s.approval_status === "approved" && (
                        <button onClick={() => toggleService(s.id, s.is_active)} className="text-xs text-muted-foreground hover:text-foreground">
                          {s.is_active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-warning" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Support Section */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">Need Help?</h2>
                <p className="text-sm text-muted-foreground mt-1">Report issues or contact support</p>
              </div>
              <Button variant="hero" size="sm" className="rounded-lg" onClick={() => navigate("/support")}>
                <HelpCircle className="w-4 h-4 mr-1" /> Create Support Ticket
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Having issues with bookings, payments, or platform features? Create a support ticket and our team will assist you.
            </p>
          </div>

          {/* Add Service Modal */}
          {showAddService && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowAddService(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-8 w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setShowAddService(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold font-display text-foreground mb-6">Add New Service</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">Title</Label>
                    <Input value={newService.title} onChange={(e) => setNewService({ ...newService, title: e.target.value })} className="bg-secondary/50 border-border mt-1" placeholder="e.g. Web Development" />
                  </div>
                  <div>
                    <Label className="text-foreground">Description</Label>
                    <Input value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} className="bg-secondary/50 border-border mt-1" placeholder="Describe your service..." />
                  </div>
                  <div>
                    <Label className="text-foreground">Category</Label>
                    <Select value={newService.category} onValueChange={(v) => setNewService({ ...newService, category: v })}>
                      <SelectTrigger className="bg-secondary/50 border-border mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {serviceCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Location</Label>
                    <Input
                      value={newService.location}
                      onChange={(e) =>
                        setNewService({ ...newService, location: e.target.value })
                      }
                      className="bg-secondary/50 border-border mt-1"
                      placeholder="City / Area (e.g. Bangalore, Indiranagar)"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground">Price (₹)</Label>
                    <Input type="number" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} className="bg-secondary/50 border-border mt-1" placeholder="500" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Your service will be reviewed by an admin before going live.</p>
                <Button
                  variant="hero"
                  className="w-full rounded-xl h-11 mt-6"
                  disabled={!newService.title || !newService.category || !newService.price || addServiceMutation.isPending}
                  onClick={() => addServiceMutation.mutate()}
                >
                  {addServiceMutation.isPending ? "Submitting..." : "Submit for Approval"}
                </Button>
              </motion.div>
            </div>
          )}

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
                </div>
                <Button variant="hero" className="w-full rounded-xl h-11 mt-6" onClick={saveProfile}>
                  <Save className="w-4 h-4 mr-1" /> Save Changes
                </Button>
              </motion.div>
            </div>
          )}

          {/* Delay Modal */}
          {showDelayModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowDelayModal(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setShowDelayModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                <h3 className="text-xl font-semibold mb-4">Set Delay / Reschedule</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Next Date</Label>
                    <Input type="date" value={delayDate} onChange={(e) => setDelayDate(e.target.value)} className="bg-secondary/50" />
                  </div>
                  <div>
                    <Label>Next Time</Label>
                    <Input type="time" value={delayTime} onChange={(e) => setDelayTime(e.target.value)} className="bg-secondary/50" />
                  </div>
                  <div>
                    <Label>Message / Reason</Label>
                    <Input value={delayMessage} onChange={(e) => setDelayMessage(e.target.value)} className="bg-secondary/50" placeholder="e.g. Running late, will reach by 2 days" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <Button variant="hero" onClick={async () => {
                    if (!delayBookingId) return;
                    const currentBooking = bookings.find((b: any) => b.id === delayBookingId);
                    const payload: any = { status: normalizeStatus(currentBooking?.status || "accepted") };
                    if (delayDate) payload.scheduled_date = delayDate;
                    if (delayTime) payload.scheduled_time = delayTime;
                    if (delayMessage) payload.notes = (delayMessage || "") + ("\n(Rescheduled by provider)");
                    await updateBookingExtended(delayBookingId, payload);
                    setShowDelayModal(false);
                    setDelayBookingId(null);
                    setDelayDate("");
                    setDelayTime("");
                    setDelayMessage("");
                  }}>Save</Button>
                  <Button variant="ghost" onClick={() => { setShowDelayModal(false); setDelayBookingId(null); }}>Cancel</Button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
