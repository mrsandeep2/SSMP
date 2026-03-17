import { useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Briefcase, CheckCircle, Star, Grid3X3, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const Stats = () => {
  const queryClient = useQueryClient();
  
  // Realtime: refresh stats when services change
  useEffect(() => {
    const ch = supabase.channel("home-stats-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [roles, availableProviders, bookings, reviews] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id").or("is_available.is.null,is_available.eq.true"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("reviews").select("rating"),
      ]);

      const availableProviderIds = (availableProviders.data ?? []).map((p: any) => p.id);
      let availableServicesCount = 0;
      if (availableProviderIds.length > 0) {
        const services = await supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("approval_status", "approved")
          .in("provider_id", availableProviderIds);
        availableServicesCount = services.count ?? 0;
      }

      const roleRows = roles.data ?? [];
      const providerUserIds = new Set(
        roleRows.filter((r) => r.role === "provider").map((r) => r.user_id)
      );
      const adminUserIds = new Set(
        roleRows.filter((r) => r.role === "admin").map((r) => r.user_id)
      );
      const providerCount = Array.from(providerUserIds).filter(
        (userId) => !adminUserIds.has(userId)
      ).length;

      const ratings = reviews.data ?? [];
      const avg = ratings.length > 0 ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : "0";
      return {
        providers: providerCount,
        services: availableServicesCount,
        completed: bookings.count ?? 0,
        avgRating: avg,
      };
    },
  });

  const items = [
    { label: "Verified Providers", value: String(stats?.providers ?? 0), icon: Users },
    { label: "Available Services", value: String(stats?.services ?? 0), icon: Briefcase },
    { label: "Completed Orders", value: String(stats?.completed ?? 0), icon: CheckCircle },
    { label: "Average Rating", value: stats?.avgRating ?? "0", icon: Star },
  ];

  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 gradient-primary opacity-5" />
      <div className="container px-4 sm:px-6 relative max-w-5xl mx-auto">
        {/* One big outer card with green border */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border-2 border-green-500/90 bg-background/40 backdrop-blur-sm p-4 sm:p-6 shadow-lg shadow-green-500/10"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {items.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-xl border-2 border-red-500/80 bg-card/60 backdrop-blur-sm p-6 text-center shadow-md shadow-red-500/5"
                >
                  <Icon className="w-6 h-6 text-accent mx-auto mb-3" />
                  <div className="text-2xl md:text-3xl font-bold font-display text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Stats;
