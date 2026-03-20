import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ScrollToHash from "@/components/ScrollToHash";
import RoleRoute from "@/components/RoleRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Services from "./pages/Services";
import SeekerDashboard from "./pages/SeekerDashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <ScrollToHash />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/services" element={<Services />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/dashboard/seeker"
              element={(
                <RoleRoute allowedRole="seeker">
                  <SeekerDashboard />
                </RoleRoute>
              )}
            />
            <Route
              path="/dashboard/provider"
              element={(
                <RoleRoute allowedRole="provider">
                  <ProviderDashboard />
                </RoleRoute>
              )}
            />
            <Route
              path="/dashboard/admin"
              element={(
                <RoleRoute allowedRole="admin">
                  <AdminDashboard />
                </RoleRoute>
              )}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
