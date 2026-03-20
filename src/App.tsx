import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ScrollToHash from "@/components/ScrollToHash";
import RoleRoute from "@/components/RoleRoute";
import Seo from "@/components/seo/Seo";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Services from "./pages/Services";
import ServiceCategoryPage from "./pages/ServiceCategoryPage";
import CityServicePage from "./pages/CityServicePage";
import Blog from "./pages/Blog";
import FaqPage from "./pages/FaqPage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import SeekerDashboard from "./pages/SeekerDashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Notifications from "./pages/Notifications";
import SupportCenter from "./pages/SupportCenter";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const withNoIndex = (element: JSX.Element) => (
  <>
    <Seo title="Private Page | SSMP" noindex canonicalPath="/" />
    {element}
  </>
);

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
            <Route path="/login" element={withNoIndex(<Login />)} />
            <Route path="/register" element={withNoIndex(<Register />)} />
            <Route path="/reset-password" element={withNoIndex(<ResetPassword />)} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:categorySlug" element={<ServiceCategoryPage />} />
            <Route path="/city/:city/:categorySlug" element={<CityServicePage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/notifications" element={withNoIndex(<Notifications />)} />
            <Route path="/support" element={withNoIndex(<SupportCenter />)} />
            <Route
              path="/dashboard/seeker"
              element={(
                <RoleRoute allowedRole="seeker">
                  {withNoIndex(<SeekerDashboard />)}
                </RoleRoute>
              )}
            />
            <Route
              path="/dashboard/provider"
              element={(
                <RoleRoute allowedRole="provider">
                  {withNoIndex(<ProviderDashboard />)}
                </RoleRoute>
              )}
            />
            <Route
              path="/dashboard/admin"
              element={(
                <RoleRoute allowedRole="admin">
                  {withNoIndex(<AdminDashboard />)}
                </RoleRoute>
              )}
            />
            <Route path="*" element={withNoIndex(<NotFound />)} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
