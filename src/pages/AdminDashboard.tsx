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
  const [editFields, setEditFields] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    location: "",
  });

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

  const { data: bookings = [] } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("*");
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

  const onlineProviderCount = users.filter(
    (u: any) => providerUserIds.has(u.id) && !adminUserIds.has(u.id) && (u as any).is_available
  ).length;

  const platformRevenue = bookings
    .filter((b: any) => b.status === "completed")
    .reduce((sum: number, b: any) => sum + Number((b as any).platform_earnings ?? Number(b.amount) * 0.15), 0);

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
      <h2 className="text-lg font-semibold mb-4">All Users</h2>
      {nonAdminUsers.map((user: any) => (
        <div
          key={user.id}
          className="mb-3 text-sm flex items-center justify-between"
        >
          <div>
            <div className="text-foreground">{user.email}</div>
            <div className="text-xs text-muted-foreground">
              Status: {user.is_blocked ? "Blocked" : "Active"}
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
      ))}
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

  /* =========================================================
     RENDER PROVIDERS
  ========================================================= */

  const renderProviders = () => (
    <div className="glass p-6">
      <h2 className="text-lg font-semibold mb-4">Providers</h2>
      {providers.map((provider: any) => (
        <div key={provider.id} className="mb-2 text-sm text-muted-foreground">
          {provider.email}
        </div>
      ))}
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
        {["overview", "approvals", "services", "users", "providers", "live"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            onClick={() => setActiveTab(tab)}
            className={tab === "live" ? "relative" : ""}
          >
            {tab === "live" && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && renderOverview()}
      {activeTab === "approvals" && renderApprovals()}
      {activeTab === "services" && renderActiveServices()}
      {activeTab === "users" && renderUsers()}
      {activeTab === "providers" && renderProviders()}
      {activeTab === "live" && renderLiveActivity()}

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
