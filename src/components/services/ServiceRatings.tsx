import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, TrendingUp, Users, ThumbsUp } from "lucide-react";

const ServiceRatings = () => {
  const { data: ratingStats, isLoading } = useQuery({
    queryKey: ["service-rating-stats"],
    queryFn: async () => {
      // Get all completed services with reviews
      const { data: services, error: servicesError } = await supabase
        .from("services")
        .select("id, title, rating, review_count")
        .eq("approval_status", "approved")
        .not("rating", "is", "null");

      if (servicesError) throw servicesError;

      const totalServices = services?.length || 0;
      const servicesWithRatings = services?.filter(s => s.rating && s.rating > 0) || [];
      const totalRatings = services?.reduce((sum, s) => sum + (s.review_count || 0), 0) || 0;
      const averageRating = servicesWithRatings.length > 0 
        ? servicesWithRatings.reduce((sum, s) => sum + s.rating, 0) / servicesWithRatings.length 
        : 0;

      return {
        totalServices,
        servicesWithRatings: servicesWithRatings.length,
        totalRatings,
        averageRating: Number(averageRating.toFixed(1)),
        topRatedServices: services
          ?.filter(s => s.rating && s.rating >= 4)
          ?.sort((a, b) => (b.rating || 0) - (a.rating || 0))
          ?.slice(0, 3) || []
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-muted/20 rounded animate-pulse"></div>
          <div className="h-4 bg-muted/20 rounded animate-pulse"></div>
          <div className="h-4 bg-muted/20 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!ratingStats) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
        <p>No rating data available</p>
      </div>
    );
  }

  const ratingPercentage = ratingStats.totalServices > 0 
    ? Math.round((ratingStats.servicesWithRatings / ratingStats.totalServices) * 100)
    : 0;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-warning" />
        <h3 className="text-lg font-semibold">Service Ratings & Reviews</h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-2xl font-bold text-foreground">{ratingStats.totalServices}</span>
          </div>
          <p className="text-xs text-muted-foreground">Total Services</p>
        </div>

        <div className="text-center p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="w-4 h-4 text-warning" />
            <span className="text-2xl font-bold text-foreground">{ratingStats.servicesWithRatings}</span>
          </div>
          <p className="text-xs text-muted-foreground">Rated Services</p>
        </div>

        <div className="text-center p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ThumbsUp className="w-4 h-4 text-success" />
            <span className="text-2xl font-bold text-foreground">{ratingStats.totalRatings}</span>
          </div>
          <p className="text-xs text-muted-foreground">Total Reviews</p>
        </div>

        <div className="text-center p-4 bg-secondary/30 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-info" />
            <span className="text-2xl font-bold text-foreground">{ratingPercentage}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Rating Coverage</p>
        </div>
      </div>

      {/* Average Rating */}
      <div className="mb-6 p-4 bg-gradient-to-r from-warning/20 to-success/20 rounded-xl">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Average Service Rating</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-foreground">{ratingStats.averageRating}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.floor(ratingStats.averageRating)
                      ? "text-warning fill-warning"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Rated Services */}
      {ratingStats.topRatedServices.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            Top Rated Services
          </h4>
          <div className="space-y-3">
            {ratingStats.topRatedServices.map((service, index) => (
              <div key={service.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                  <span className="text-sm font-medium text-foreground">{service.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-warning fill-warning" />
                  <span className="text-sm font-bold text-foreground">{service.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRatings;
