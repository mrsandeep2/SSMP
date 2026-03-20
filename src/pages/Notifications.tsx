import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Home } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentNotifications } from "@/hooks/usePersistentNotifications";

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading, role } = useAuth();
  const { notifications, unreadCount, loading: loadingNotifications, markRead, markAllRead } =
    usePersistentNotifications(user?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const dashboardPath =
    role === "provider" ? "/dashboard/provider" : role === "admin" ? "/dashboard/admin" : "/dashboard/seeker";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 pt-24 pb-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">Notification Center</h1>
            <p className="mt-1 text-muted-foreground">
              Persistent history of your alerts. Unread: {unreadCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(dashboardPath)}>
              <Home className="mr-1 h-4 w-4" /> Back to Dashboard
            </Button>
            <Button variant="hero" size="sm" disabled={unreadCount === 0} onClick={markAllRead}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 md:p-6">
          {loadingNotifications ? (
            <p className="py-8 text-center text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    item.is_read
                      ? "border-border/60 bg-background/40"
                      : "border-accent/40 bg-accent/10"
                  }`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground/80">{formatDateTime(item.created_at)}</p>
                    </div>
                    {!item.is_read && (
                      <Button variant="outline" size="sm" onClick={() => markRead(item.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;