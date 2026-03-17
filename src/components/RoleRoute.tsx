import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "seeker" | "provider" | "admin";

const dashboardByRole: Record<AppRole, string> = {
  seeker: "/dashboard/seeker",
  provider: "/dashboard/provider",
  admin: "/dashboard/admin",
};

interface RoleRouteProps {
  allowedRole: AppRole;
  children: ReactNode;
}

const RoleRoute = ({ allowedRole, children }: RoleRouteProps) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/" replace />;
  if (role !== allowedRole) return <Navigate to={dashboardByRole[role as AppRole] || "/"} replace />;

  return <>{children}</>;
};

export default RoleRoute;
