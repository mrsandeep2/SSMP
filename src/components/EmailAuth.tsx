import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EmailAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { toast } = useToast();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage({ type: "error", text: "Enter a valid email address." });
      return;
    }

    if (!password) {
      setMessage({ type: "error", text: "Password is required." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = error.message || "Wrong email or password.";
        setMessage({ type: "error", text: msg });
        toast({ title: "Sign in failed", description: msg, variant: "destructive" });
        return;
      }

      setMessage({ type: "success", text: "Signed in successfully." });
      toast({ title: "Welcome back!" });
    } finally {
      setLoading(false);
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
    <form className="space-y-5" onSubmit={handleEmailSignIn}>
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-destructive/40 bg-destructive/10 text-red-200"}`}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

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
            disabled={loading}
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
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 bg-secondary/50 border-border"
            disabled={loading}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="text-right -mt-2">
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={resetLoading || loading}
          className="text-sm text-accent hover:underline disabled:opacity-60"
        >
          {resetLoading ? "Sending reset link..." : "Forgot password?"}
        </button>
      </div>

      <Button variant="hero" className="w-full rounded-xl h-11" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"} <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </form>
  );
};

export default EmailAuth;