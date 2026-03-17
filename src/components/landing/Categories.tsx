import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { serviceCategories } from "@/data/marketplace";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const fetchCategoryCounts = async () => {
  const { data: availableProviders, error: providersError } = await supabase
    .from("profiles")
    .select("id")
    .or("is_available.is.null,is_available.eq.true");
  if (providersError) throw providersError;

  const availableProviderIds = (availableProviders ?? []).map((p: any) => p.id);
  if (availableProviderIds.length === 0) return {};

  const { data, error } = await supabase
    .from("services")
    .select("category")
    .eq("approval_status", "approved")
    .or("is_active.is.null,is_active.eq.true")
    .in("provider_id", availableProviderIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data ?? []).forEach((s: any) => {
    counts[s.category] = (counts[s.category] || 0) + 1;
  });
  return counts;
};

const Categories = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  useEffect(() => {
    const ch = supabase.channel("home-categories-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        queryClient.invalidateQueries({ queryKey: ["category-counts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["category-counts"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const { data: counts = {} } = useQuery({
    queryKey: ["category-counts"],
    queryFn: fetchCategoryCounts,
  });

  const availableCategories = serviceCategories.filter((cat) => (counts[cat.name] || 0) > 0);

  return (
    <section id="categories" className="py-24 relative">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Explore <span className="gradient-text">Categories</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Browse through dozens of service categories to find exactly what you need
          </p>
        </motion.div>

        {availableCategories.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No categories available yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableCategories.map((cat, i) => {
              const Icon = cat.icon;
              const count = counts[cat.name] || 0;
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="glass glass-hover rounded-2xl p-6 cursor-pointer group transition-all duration-300 relative overflow-hidden min-h-[220px]"
                  onClick={() =>
                    navigate(
                      `/services?${new URLSearchParams({ cat: cat.name }).toString()}`
                    )
                  }
                >
                  {/* Ambient glow */}
                  <div className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full bg-primary/20 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="pointer-events-none absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-accent/15 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative h-full flex flex-col items-center text-center">
                    {/* Icon centered */}
                    <div className="flex-1 w-full flex items-center justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/35 via-accent/25 to-warning/25 blur-xl opacity-70" />
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Icon className="w-8 h-8 md:w-9 md:h-9 text-primary-foreground" />
                        </div>
                      </div>
                    </div>

                    <div className="w-full mt-4">
                      <h3 className="font-display font-semibold text-foreground mb-1">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{cat.description}</p>
                      <span className="inline-flex items-center justify-center text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                        {`${count.toLocaleString()} services`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Categories;
