import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type RoleType = "seeker" | "provider";

const Register = () => {
  const [role, setRole] = useState<RoleType>("seeker");

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const [emailLoading, setEmailLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    if (!name.trim()) {
      setFormMessage({ type: "error", text: "Full name is required." });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFormMessage({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (emailPassword.length < 6) {
      setFormMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setEmailLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: emailPassword,
        options: {
          data: { name: name.trim(), role },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setFormMessage({ type: "error", text: error.message });
        toast({ title: "Registration failed", description: error.message, variant: "destructive" });
        return;
      }

      if (data.user && !data.session) {
        setFormMessage({ type: "success", text: "Account created. Please verify your email before login." });
        toast({ title: "Verify your email", description: "We sent a verification link to your inbox." });
      } else {
        setFormMessage({ type: "success", text: "Account created successfully." });
        toast({ title: "Account created", description: "You can now login." });
      }

      navigate("/login");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-10">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-accent/10 rounded-full blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_25%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_88%_68%,rgba(56,189,248,0.14),transparent_40%)]" />

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
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground">Create an account with email and password</p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          <div className="flex gap-2 mb-5 p-1 bg-secondary/50 rounded-xl">
            <button
              type="button"
              onClick={() => setRole("seeker")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${role === "seeker" ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              I need services
            </button>
            <button
              type="button"
              onClick={() => setRole("provider")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${role === "provider" ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              I provide service
            </button>
          </div>

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
            onSubmit={handleEmailSignUp}
          >
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                  disabled={emailLoading}
                  required
                />
              </div>
            </div>

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

            <Button variant="hero" className="w-full rounded-xl h-11" type="submit" disabled={emailLoading}>
              {emailLoading ? "Creating..." : `Create ${role === "seeker" ? "Seeker" : "Provider"} Account`} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
