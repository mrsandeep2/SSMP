import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const [emailLoading, setEmailLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const routeSupabaseUserToDashboard = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      navigate("/dashboard/seeker");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_blocked")
      .eq("id", authUser.id)
      .maybeSingle();

    if ((profileData as { is_blocked?: boolean } | null)?.is_blocked) {
      await signOut();
      setFormMessage({ type: "error", text: "Your account has been blocked by admin." });
      toast({ title: "Account blocked", description: "Please contact support.", variant: "destructive" });
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id)
      .maybeSingle();

    const userRole = roleData?.role ?? "seeker";
    if (userRole === "admin") navigate("/dashboard/admin");
    else if (userRole === "provider") navigate("/dashboard/provider");
    else navigate("/dashboard/seeker");
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFormMessage({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (!emailPassword) {
      setFormMessage({ type: "error", text: "Password is required." });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: emailPassword,
      });

      if (error) {
        setFormMessage({ type: "error", text: error.message || "Wrong email or password." });
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
        return;
      }

      setFormMessage({ type: "success", text: "Signed in successfully." });
      toast({ title: "Welcome back!" });
      await routeSupabaseUserToDashboard();
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter your email first, then click Forgot password.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);

    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Reset email sent",
      description: "Check your inbox and open the reset link.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-10">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_80%_65%,rgba(56,189,248,0.14),transparent_40%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">SS</span>
            </div>
          </Link>
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">Access Your Account</h1>
          <p className="text-muted-foreground">Sign in with your email and password</p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          {formMessage && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${formMessage.type === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-destructive/40 bg-destructive/10 text-red-200"}`}
              role="status"
              aria-live="polite"
            >
              {formMessage.text}
            </div>
          )}

          <motion.form
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
            onSubmit={handleEmailSignIn}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                  disabled={emailLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-password" className="text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email-password"
                  type={showEmailPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  className="pl-10 pr-10 bg-secondary/50 border-border"
                  disabled={emailLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowEmailPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showEmailPassword ? "Hide password" : "Show password"}
                >
                  {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading || emailLoading}
                className="text-sm text-accent hover:underline disabled:opacity-60"
              >
                {resetLoading ? "Sending reset link..." : "Forgot password?"}
              </button>
            </div>

            <Button variant="hero" className="w-full rounded-xl h-11" type="submit" disabled={emailLoading}>
              {emailLoading ? "Signing in..." : "Sign In"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent hover:underline font-medium">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
