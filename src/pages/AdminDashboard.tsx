import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "@/styles/admin-dashboard.css";
import {
  Shield,
  Users,
  UserCheck,
  ShoppingCart,
  IndianRupee,
  AlertTriangle,
  Package,
  Home,
  Save,
  X,
  Trash2,
  Edit,
  Ban,
  CheckCircle2,
  CheckCircle,
  Wifi,
  Activity,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import CallButton from "@/components/videocall/CallButton";
import CallIncomingDialog from "@/components/videocall/CallIncomingDialog";
import VideoCallModal from "@/components/videocall/VideoCallModal";
import { useVideoCall } from "@/hooks/useVideoCall";

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [supportTab, setSupportTab] = useState<"seeker" | "provider">("seeker");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [bookingStatusDrafts, setBookingStatusDrafts] = useState<Record<string, string>>({});
  const [unresolvedSeekerCount, setUnresolvedSeekerCount] = useState(0);
  const [unresolvedProviderCount, setUnresolvedProviderCount] = useState(0);
  const [acceptedIncomingCall, setAcceptedIncomingCall] = useState<any | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [userFilter, setUserFilter] = useState<
    "active_seekers" | "active_providers" | "blocked_seekers" | "blocked_providers"
  >("active_seekers");
  const [editFields, setEditFields] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    location: "",
  });

  const {
    incomingCalls,
    pendingCall,
    activeCall,
    acceptCall,
    acceptCallLoading,
    declineCall,
    declineCallLoading,
    endCall,
  } = useVideoCall();
  // Auto-open video call modal for both users when call is active
  useEffect(() => {
    if (activeCall && activeCall.status === "active") {
      setAcceptedIncomingCall(activeCall);
      setShowVideoCall(true);
    } else {
      setShowVideoCall(false);
    }
  }, [activeCall]);

  // Realtime: update approvals list when providers submit/updates services
  useEffect(() => {
    const ch = supabase
      .channel("admin-services-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-services"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  // Realtime: update support tickets when created or updated
  useEffect(() => {
    const ch = supabase
      .channel("admin-support-tickets-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  // Realtime: reflect profile changes (availability/block) in Admin users/providers
  useEffect(() => {
    const ch = supabase
      .channel("admin-profiles-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  // Realtime: role changes (provider/admin) should refresh admin user/provider metrics
  useEffect(() => {
    const ch = supabase
      .channel("admin-roles-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  // Realtime: new booking events → refresh live activity feed
  useEffect(() => {
    const ch = supabase
      .channel("admin-activity-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_events" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-booking-events"] });
          queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const [newService, setNewService] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    customCategory: "",
    location: "",
  });

  /* =========================================================
     FETCH DATA
  ========================================================= */

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    }
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data || [];
    }
  });

  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*");
      return data || [];
    }
  });

  const { data: bookings = [], error: bookingsError } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: bookingEvents = [] } = useQuery({
    queryKey: ["admin-booking-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  const { data: supportTickets = [] } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets" as any)
        .select("id,ticket_code,created_by_role,type,subject,status,priority,booking_id,service_id,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  // Calculate unresolved ticket counts in real-time
  useEffect(() => {
    const unresolved = (supportTickets as any[]).filter(
      (t) => t.status === "open" || t.status === "in_review"
    );
    const seekerUnresolved = unresolved.filter((t) => t.created_by_role === "seeker").length;
    const providerUnresolved = unresolved.filter((t) => t.created_by_role === "provider").length;
    
    setUnresolvedSeekerCount(seekerUnresolved);
    setUnresolvedProviderCount(providerUnresolved);
  }, [supportTickets]);

  useEffect(() => {
    if (!bookingsError) return;
    toast({
      title: "Bookings load failed",
      description: (bookingsError as any).message || "Could not fetch bookings for admin.",
      variant: "destructive",
    });
  }, [bookingsError, toast]);

  /* =========================================================
     CALCULATIONS
  ========================================================= */

  const totalRevenue = bookings.reduce(
    (sum: number, booking: any) => sum + Number(booking.amount || 0),
    0
  );

  const pendingApprovals = services.filter(
    (s: any) => s.approval_status === "pending"
  );

  const providerUserIds = new Set(
    userRoles
      .filter((r: any) => r.role === "provider")
      .map((r: any) => r.user_id)
  );
  const adminUserIds = new Set(
    userRoles
      .filter((r: any) => r.role === "admin")
      .map((r: any) => r.user_id)
  );

  const providerCount = Array.from(providerUserIds).filter(
    (id) => !adminUserIds.has(id)
  ).length;

  const providers = users.filter(
    (u: any) => providerUserIds.has(u.id) && !adminUserIds.has(u.id)
  );

  // Non-admin users only (seekers + providers)
  const nonAdminUsers = users.filter((u: any) => !adminUserIds.has(u.id));

  const roleByUserId = userRoles.reduce((acc: Map<string, Set<string>>, row: any) => {
    if (!acc.has(row.user_id)) acc.set(row.user_id, new Set());
    acc.get(row.user_id)!.add(row.role);
    return acc;
  }, new Map());

  const getPrimaryRole = (userId: string) =>
    roleByUserId.get(userId)?.has("provider") ? "provider" : "seeker";

  const getUserStatus = (u: any) => (u.is_blocked ? "blocked" : "active");

  const filteredUsers = nonAdminUsers.filter((u: any) => {
    const role = getPrimaryRole(u.id);
    const status = getUserStatus(u);
    if (userFilter === "active_seekers") return role === "seeker" && status === "active";
    if (userFilter === "active_providers") return role === "provider" && status === "active";
    if (userFilter === "blocked_seekers") return role === "seeker" && status === "blocked";
    return role === "provider" && status === "blocked";
  });

  const onlineProviderCount = users.filter(
    (u: any) => providerUserIds.has(u.id) && !adminUserIds.has(u.id) && (u as any).is_available
  ).length;

  const platformRevenue = bookings
    .filter((b: any) => (b as any).payment_status === "paid")
    .reduce((sum: number, b: any) => sum + Number((b as any).platform_earnings ?? Number(b.amount) * 0.15), 0);

  const lifecycleOrder = ["pending", "accepted", "on_the_way", "arrived", "started", "completed"];
  const allAdminStatuses = ["pending", "accepted", "on_the_way", "arrived", "started", "completed", "cancelled", "disputed"];

  const normalizeStatus = (status: string) => {
    if (status === "confirmed") return "accepted";
    if (status === "in_progress") return "started";
    return status;
  };

  const getStatusClass = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === "completed") return "bg-success/20 text-success";
    if (normalized === "cancelled" || normalized === "disputed") return "bg-destructive/20 text-destructive";
    if (normalized === "pending") return "bg-warning/20 text-warning";
    return "bg-info/20 text-info";
  };

  const stageIndex = (status: string) => lifecycleOrder.indexOf(normalizeStatus(status));

  const getUserDisplayName = (id: string) => {
    const u = users.find((x: any) => x.id === id);
    if (!u) return `${id?.slice(0, 8)}...`;
    return u.name || u.email || `${id?.slice(0, 8)}...`;
  };

  const getServiceTitle = (serviceId: string) => {
    const s = services.find((x: any) => x.id === serviceId);
    return s?.title || `Service ${String(serviceId).slice(0, 8)}...`;
  };

  const handleAdminBookingStatusChange = async (booking: any) => {
    const nextStatus = bookingStatusDrafts[booking.id] || booking.status;
    if (nextStatus === booking.status) return;

    setUpdatingBookingId(booking.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: nextStatus } as any)
      .eq("id", booking.id);
    setUpdatingBookingId(null);

    if (error) {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Booking status changed", description: `Updated to ${nextStatus.replace(/_/g, " ")}` });
    queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["admin-booking-events"] });
  };

  const handleResolveTicket = async (ticketId: string) => {
    setResolvingTicketId(ticketId);
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "resolved" })
      .eq("id", ticketId);
    setResolvingTicketId(null);

    if (error) {
      toast({ title: "Failed to resolve ticket", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Ticket resolved", description: "Support ticket marked as resolved." });
    queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
  };

  const handleCloseTicket = async (ticketId: string) => {
    setResolvingTicketId(ticketId);
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", ticketId);
    setResolvingTicketId(null);

    if (error) {
      toast({ title: "Failed to close ticket", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Ticket closed", description: "Support ticket marked as closed." });
    queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
  };

  const openEditService = (service: any) => {
    setEditingService(service);
    setEditFields({
      title: service.title ?? "",
      description: service.description ?? "",
      category: service.category ?? "",
      price: String(service.price ?? ""),
      location: service.location ?? "",
    });
  };

  const handleSaveService = async () => {
    if (!editingService) return;
    const { error } = await supabase
      .from("services")
      .update({
        title: editFields.title,
        description: editFields.description,
        category: editFields.category,
        price: Number(editFields.price || 0),
        location: editFields.location,
      })
      .eq("id", editingService.id);

    if (error) {
      toast({
        title: "Error updating service",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Service updated" });
    setEditingService(null);
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
  };

  const handleDeleteService = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast({
        title: "Error deleting service",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Service deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
  };

  const handleToggleBlockUser = async (userId: string, isBlocked: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: !isBlocked } as any)
      .eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isBlocked ? "User unblocked" : "User blocked" });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  /* =========================================================
     CREATE SERVICE FUNCTION
  ========================================================= */

  const handleCreateService = async () => {
    const finalCategory =
      newService.category === "Other"
        ? newService.customCategory
        : newService.category;

    if (!newService.title || !newService.price || !finalCategory || !newService.location) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields including location",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("services").insert({
      provider_id: user.id,
      title: newService.title,
      description: newService.description,
      price: Number(newService.price),
      category: finalCategory,
      location: newService.location,
      approval_status: "approved",
      is_active: true,
    });

    if (!error) {
      toast({ title: "Service Created Successfully" });
      setShowAddService(false);
      setNewService({
        title: "",
        description: "",
        price: "",
        category: "",
        customCategory: "",
        location: "",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    }
  };

  /* =========================================================
     APPROVE SERVICE FUNCTION
  ========================================================= */

const handleApproveService = async (id: string) => {
  const { error } = await supabase
    .from("services")
    .update({ approval_status: "approved", is_active: true })
    .eq("id", id);

  if (!error) {
    toast({ title: "Service Approved Successfully" });

    // Refresh Admin page
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });

    // 🔥 VERY IMPORTANT: Refresh Services page (Home page)
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "services"
    });
  }
};


  /* =========================================================
     RENDER OVERVIEW
  ========================================================= */

  const renderOverview = () => (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={<Users />}
          title="Total Users"
          value={nonAdminUsers.length}
        />
        <StatCard
          icon={<UserCheck />}
          title="Providers"
          value={providerCount}
        />
        <StatCard
          icon={<Wifi />}
          title="Online Now"
          value={onlineProviderCount}
        />
        <StatCard
          icon={<ShoppingCart />}
          title="Bookings"
          value={bookings.length}
        />
        <StatCard
          icon={<IndianRupee />}
          title="Platform Revenue"
          value={`₹${Math.round(platformRevenue).toLocaleString("en-IN")}`}
        />
        <StatCard
          icon={<AlertTriangle />}
          title="Pending"
          value={pendingApprovals.length}
        />
      </div>

      {/* Bottom Cards */}
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-4">Top Categories</h2>
          {services.length === 0 ? (
            <p className="text-muted-foreground">No services yet</p>
          ) : (
            [...new Set(services.map((s: any) => s.category))]
              .slice(0, 5)
              .map((cat: any) => (
                <p key={cat} className="text-sm mb-2">
                  {cat}
                </p>
              ))
          )}
        </div>

        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Users</h2>
          {nonAdminUsers.slice(0, 5).map((user: any) => (
            <p key={user.id} className="text-sm text-muted-foreground mb-2">
              {user.email}
            </p>
          ))}
        </div>
      </div>
    </>
  );

  /* =========================================================
     RENDER APPROVALS
  ========================================================= */

  const renderApprovals = () => (
    <div className="glass p-6">
      <h2 className="text-lg font-semibold mb-4">
        Pending Approvals ({pendingApprovals.length})
      </h2>

      {pendingApprovals.map((service: any) => (
        <div
          key={service.id}
          className="flex justify-between items-center mb-4 border border-border p-4 rounded-lg"
        >
          <div>
            <h3>{service.title}</h3>
            <p className="text-sm text-muted-foreground">₹{service.price}</p>
            <p className="text-xs text-muted-foreground">
              {service.location || "No location set"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditService(service)}
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteService(service.id)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Button size="sm" onClick={() => handleApproveService(service.id)}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  /* =========================================================
     RENDER USERS
  ========================================================= */

  const renderUsers = () => (
    <div className="glass p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={userFilter === "active_seekers" ? "hero" : "outline"}
            onClick={() => setUserFilter("active_seekers")}
          >
            Active Seekers
          </Button>
          <Button
            size="sm"
            variant={userFilter === "active_providers" ? "hero" : "outline"}
            onClick={() => setUserFilter("active_providers")}
          >
            Active Providers
          </Button>
          <Button
            size="sm"
            variant={userFilter === "blocked_seekers" ? "hero" : "outline"}
            onClick={() => setUserFilter("blocked_seekers")}
          >
            Blocked Seekers
          </Button>
          <Button
            size="sm"
            variant={userFilter === "blocked_providers" ? "hero" : "outline"}
            onClick={() => setUserFilter("blocked_providers")}
          >
            Blocked Providers
          </Button>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found for this filter.</p>
      ) : (
        filteredUsers.map((user: any) => (
          <div
            key={user.id}
            className="mb-3 text-sm flex items-center justify-between"
          >
            <div>
              <div className="text-foreground">{user.email}</div>
              <div className="text-xs text-muted-foreground">
                Status: {getUserStatus(user) === "blocked" ? "Blocked" : "Active"}
              </div>
            </div>
            <Button
              size="sm"
              variant={user.is_blocked ? "outline" : "destructive"}
              onClick={() => handleToggleBlockUser(user.id, user.is_blocked)}
            >
              {user.is_blocked ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Unblock
                </>
              ) : (
                <>
                  <Ban className="w-3 h-3 mr-1" />
                  Block
                </>
              )}
            </Button>
          </div>
        ))
      )}
    </div>
  );

  /* =========================================================
     RENDER ACTIVE SERVICES
  ========================================================= */

  const renderActiveServices = () => {
    const activeServices = services.filter(
      (s: any) => s.approval_status === "approved" && s.is_active
    );
    return (
      <div className="glass p-6">
        <h2 className="text-lg font-semibold mb-4">
          Active Services ({activeServices.length})
        </h2>
        {activeServices.map((service: any) => (
          <div
            key={service.id}
            className="flex justify-between items-center mb-4 border border-border p-4 rounded-lg"
          >
            <div>
              <h3 className="font-semibold">{service.title}</h3>
              <p className="text-sm text-muted-foreground">
                {service.category} · ₹{service.price}
              </p>
              <p className="text-xs text-muted-foreground">
                {service.location || "No location set"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditService(service)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteService(service.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderBookings = () => (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">All Booking Tracking</h2>
        <span className="text-xs text-muted-foreground">Admin can force-change status for complaint handling</span>
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings available.</p>
      ) : (
        <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
          {(bookings as any[]).map((b: any) => {
            const current = normalizeStatus(b.status);
            const currentStageIndex = stageIndex(b.status);
            const draftStatus = bookingStatusDrafts[b.id] || b.status;
            return (
              <div key={b.id} className="rounded-xl border border-border/40 bg-secondary/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">{getServiceTitle(b.service_id)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Seeker: {getUserDisplayName(b.seeker_id)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Provider: {getUserDisplayName(b.provider_id)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.scheduled_date || "No date"} {b.scheduled_time ? `· ${b.scheduled_time}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusClass(current)}`}>
                      {current.replace(/_/g, " ")}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${(b.payment_status === "paid") ? "bg-success/20 text-success" : (b.payment_status === "requested") ? "bg-info/20 text-info" : "bg-warning/20 text-warning"}`}>
                      Payment: {(b.payment_status || "unpaid").replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-semibold text-foreground">₹{b.amount}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {lifecycleOrder.map((step, idx) => {
                    const done = currentStageIndex >= idx;
                    return (
                      <span
                        key={`${b.id}-${step}`}
                        className={`text-[10px] px-2 py-1 rounded-full border uppercase tracking-wide ${done ? "bg-accent/20 border-accent/40 text-foreground" : "bg-background/50 border-border text-muted-foreground"}`}
                      >
                        {step.replace(/_/g, " ")}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <select
                    value={draftStatus}
                    onChange={(e) =>
                      setBookingStatusDrafts((prev) => ({
                        ...prev,
                        [b.id]: e.target.value,
                      }))
                    }
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {allAdminStatuses.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={updatingBookingId === b.id || draftStatus === b.status}
                    onClick={() => handleAdminBookingStatusChange(b)}
                  >
                    {updatingBookingId === b.id ? "Updating..." : "Update Status"}
                  </Button>
                  <CallButton
                    bookingId={b.id}
                    serviceId={b.service_id}
                    receiverId={b.seeker_id}
                    receiverName="Seeker"
                    initiatorRole="admin"
                    size="sm"
                    showLabel={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* =========================================================
     RENDER LIVE ACTIVITY
  ========================================================= */

  const statusDotColor = (status: string) => {
    if (status === "completed") return "bg-emerald-500";
    if (status === "cancelled" || status === "disputed") return "bg-destructive";
    if (status === "on_the_way" || status === "arrived") return "bg-sky-400";
    if (status === "started") return "bg-amber-400";
    return "bg-accent";
  };

  const renderLiveActivity = () => (
    <div className="space-y-4">
      {/* Online providers */}
      <div className="glass p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Online Providers ({onlineProviderCount})
        </h2>
        {providers.filter((p: any) => (p as any).is_available).length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers online right now.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {providers.filter((p: any) => (p as any).is_available).map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-foreground">{p.name || p.email}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Live Booking Activity
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Realtime
          </span>
        </div>
        {bookingEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {(bookingEvents as any[]).map((event: any) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30"
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDotColor(event.to_status ?? "")}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {event.event_type === "created" ? "New booking created" : "Status update"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.created_at).toLocaleTimeString()} · {new Date(event.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {event.from_status && event.to_status && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-muted-foreground">{event.from_status.replace(/_/g, " ")}</span>
                      {" → "}
                      <span className="text-foreground font-medium">{event.to_status.replace(/_/g, " ")}</span>
                    </p>
                  )}
                  {event.event_type === "created" && event.metadata?.amount && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Amount: ₹{event.metadata.amount}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono truncate">
                    booking {String(event.booking_id).split("-")[0]}…
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSupport = () => {
    const seekerTickets = (supportTickets as any[]).filter((t: any) => t.created_by_role === "seeker");
    const providerTickets = (supportTickets as any[]).filter((t: any) => t.created_by_role === "provider");
    const tickets = supportTab === "seeker" ? seekerTickets : providerTickets;

    return (
      <div className="space-y-6">
        {/* Tab Buttons */}
        <div className="flex gap-3">
          <Button
            variant={supportTab === "seeker" ? "hero" : "outline"}
            onClick={() => { setSupportTab("seeker"); setExpandedTicketId(null); }}
            className="rounded-lg relative"
          >
            {unresolvedSeekerCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-pulse">
                {unresolvedSeekerCount}
              </span>
            )}
            Seeker ({seekerTickets.length})
          </Button>
          <Button
            variant={supportTab === "provider" ? "hero" : "outline"}
            onClick={() => { setSupportTab("provider"); setExpandedTicketId(null); }}
            className="rounded-lg relative"
          >
            {unresolvedProviderCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-pulse">
                {unresolvedProviderCount}
              </span>
            )}
            Provider ({providerTickets.length})
          </Button>
        </div>

        {/* Tickets Grid */}
        {tickets.length === 0 ? (
          <div className="glass p-8 text-center">
            <p className="text-muted-foreground">No {supportTab} tickets found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket: any) => {
              const isExpanded = expandedTicketId === ticket.id;
              const statusColor = 
                ticket.status === "resolved" ? "bg-success/20 text-success" :
                ticket.status === "closed" ? "bg-muted/20 text-muted-foreground" :
                ticket.status === "in_review" ? "bg-info/20 text-info" :
                ticket.status === "open" ? "bg-warning/20 text-warning" :
                "bg-secondary/20 text-foreground";

              const priorityColor =
                ticket.priority === "urgent" ? "bg-destructive/20 text-destructive border-destructive/30" :
                ticket.priority === "high" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                ticket.priority === "normal" ? "bg-info/20 text-info border-info/30" :
                "bg-muted/20 text-muted-foreground border-border/30";

              return (
                <div
                  key={ticket.id}
                  className={`glass rounded-xl border transition-all cursor-pointer overflow-hidden ${
                    isExpanded
                      ? "md:col-span-2 lg:col-span-3 p-6 border-accent/50"
                      : "p-4 border-border/30 hover:border-accent/50 hover:bg-secondary/20"
                  }`}
                  onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                >
                  <div className="space-y-2">
                    {/* Header with badges and date */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-accent font-semibold">
                          {ticket.ticket_code || ticket.id.slice(0, 8)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColor}`}>
                          {ticket.status}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize border ${priorityColor}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className={`font-semibold text-foreground mb-1 ${isExpanded ? "text-base" : "text-sm line-clamp-2"}`}>
                        {ticket.subject}
                      </h3>
                      <p className={`text-xs text-muted-foreground ${isExpanded ? "block" : "line-clamp-1"}`}>
                        {ticket.description}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 space-y-4 pt-6 border-t border-border/30">
                      {/* Full Details */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
                          <p className="text-sm text-foreground capitalize mt-1">{ticket.type}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Full Description</label>
                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{ticket.description}</p>
                        </div>
                        {ticket.booking_id && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase">Booking ID</label>
                              <p className="text-xs text-accent font-mono mt-1">{ticket.booking_id.slice(0, 16)}...</p>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase">Service ID</label>
                              <p className="text-xs text-muted-foreground font-mono mt-1">{ticket.service_id ? ticket.service_id.slice(0, 16) + "..." : "-"}</p>
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(ticket.created_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t border-border/30">
                        {ticket.status !== "resolved" && ticket.status !== "closed" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolveTicket(ticket.id);
                              }}
                              disabled={resolvingTicketId === ticket.id}
                              className="rounded-lg flex-1"
                            >
                              {resolvingTicketId === ticket.id ? "..." : "Resolve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseTicket(ticket.id);
                              }}
                              disabled={resolvingTicketId === ticket.id}
                              className="rounded-lg flex-1"
                            >
                              {resolvingTicketId === ticket.id ? "..." : "Close"}
                            </Button>
                          </>
                        )}
                        {(ticket.status === "resolved" || ticket.status === "closed") && (
                          <div className="flex items-center gap-2 text-success text-sm font-medium w-full justify-center">
                            <CheckCircle className="w-4 h-4" />
                            {ticket.status}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background admin-dashboard-root">
      <Navbar />
      <div className="container px-4 pt-24 pb-12 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Platform overview and management
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <Button onClick={() => setShowAddService(true)}>
            <Package className="w-4 h-4 mr-2" />
            Add Service
          </Button>

          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            Admin
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3">
        {["overview", "approvals", "services", "users", "bookings", "live", "support"].map((tab) => {
          const totalUnresolved = unresolvedSeekerCount + unresolvedProviderCount;
          const showBadge = tab === "support" && totalUnresolved > 0;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          
          return (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              onClick={() => setActiveTab(tab)}
              className={`relative overflow-visible ${tab === "live" ? "" : ""}`}
            >
              {tab === "live" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {tab === "approvals" && (
                <span
                  className={`absolute -top-2.5 -right-2.5 min-w-5 h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center ${
                    pendingApprovals.length > 0
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-slate-700/70 text-slate-300"
                  }`}
                >
                  {pendingApprovals.length}
                </span>
              )}
              {showBadge && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-pulse">
                  {totalUnresolved}
                </span>
              )}
              {label}
            </Button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "approvals" && renderApprovals()}
      {activeTab === "services" && renderActiveServices()}
      {activeTab === "users" && renderUsers()}
      {activeTab === "bookings" && renderBookings()}
      {activeTab === "live" && renderLiveActivity()}
      {activeTab === "support" && renderSupport()}

      {/* ADD SERVICE MODAL */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="glass p-8 w-full max-w-lg space-y-4 relative">
            <button
              onClick={() => setShowAddService(false)}
              className="absolute top-4 right-4"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold">Add New Service</h2>

            <Input
              placeholder="Title"
              value={newService.title}
              onChange={(e) =>
                setNewService({ ...newService, title: e.target.value })
              }
            />

            <Textarea
              placeholder="Description"
              value={newService.description}
              onChange={(e) =>
                setNewService({ ...newService, description: e.target.value })
              }
            />

            <Input
              placeholder="Category"
              value={newService.category}
              onChange={(e) =>
                setNewService({ ...newService, category: e.target.value })
              }
            />

            <Input
              type="number"
              placeholder="Price"
              value={newService.price}
              onChange={(e) =>
                setNewService({ ...newService, price: e.target.value })
              }
            />

            <Input
              placeholder="Location (city / area)"
              value={newService.location}
              onChange={(e) =>
                setNewService({ ...newService, location: e.target.value })
              }
            />

            <Button
              className="w-full"
              onClick={handleCreateService}
            >
              <Save className="w-4 h-4 mr-2" />
              Create Service
            </Button>
          </div>
        </div>
      )}
      {/* EDIT SERVICE MODAL */}
      {editingService && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="glass p-8 w-full max-w-lg space-y-4 relative">
            <button
              onClick={() => setEditingService(null)}
              className="absolute top-4 right-4"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold">Edit Service</h2>

            <Input
              placeholder="Title"
              value={editFields.title}
              onChange={(e) =>
                setEditFields({ ...editFields, title: e.target.value })
              }
            />

            <Textarea
              placeholder="Description"
              value={editFields.description}
              onChange={(e) =>
                setEditFields({ ...editFields, description: e.target.value })
              }
            />

            <Input
              placeholder="Category"
              value={editFields.category}
              onChange={(e) =>
                setEditFields({ ...editFields, category: e.target.value })
              }
            />

            <Input
              type="number"
              placeholder="Price"
              value={editFields.price}
              onChange={(e) =>
                setEditFields({ ...editFields, price: e.target.value })
              }
            />

            <Input
              placeholder="Location (city / area)"
              value={editFields.location}
              onChange={(e) =>
                setEditFields({ ...editFields, location: e.target.value })
              }
            />

            <Button className="w-full" onClick={handleSaveService}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Incoming Call Dialog */}
      <CallIncomingDialog
        call={pendingCall || (incomingCalls.length > 0 ? incomingCalls[0] : null)}
        onAccept={() => {
          const targetCall = pendingCall || (incomingCalls.length > 0 ? incomingCalls[0] : null);
          if (targetCall) {
            acceptCall(targetCall.id, {
              onSuccess: (updated: any) => {
                setAcceptedIncomingCall(updated);
              },
            });
          }
        }}
        onDecline={() => {
          const targetCall = pendingCall || (incomingCalls.length > 0 ? incomingCalls[0] : null);
          if (targetCall) {
            declineCall({ callId: targetCall.id, reason: "User declined" });
          }
        }}
        acceptLoading={acceptCallLoading}
        declineLoading={declineCallLoading}
        initiatorName="Seeker"
      />
      {showVideoCall && acceptedIncomingCall && (
        <VideoCallModal
          roomName={acceptedIncomingCall.room_name}
          displayName="Admin"
          onCallEnd={(durationSeconds) => {
            endCall({ callId: acceptedIncomingCall.id, duration: durationSeconds });
            setAcceptedIncomingCall(null);
            setShowVideoCall(false);
          }}
          onClose={() => {
            setAcceptedIncomingCall(null);
            setShowVideoCall(false);
          }}
        />
      )}
      </div>
    </div>
  );
}

/* =========================================================
   STAT CARD COMPONENT
========================================================= */

function StatCard({ icon, title, value }: any) {
  return (
    <div className="glass p-6 flex flex-col gap-3">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <h2 className="text-2xl font-bold">{value}</h2>
      </div>
    </div>
  );
}
