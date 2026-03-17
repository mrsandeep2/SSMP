import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const dashboardPath = role === "provider" ? "/dashboard/provider" : role === "admin" ? "/dashboard/admin" : "/dashboard/seeker";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 backdrop-blur-xl">
      <div className="container px-4 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SS</span>
          </div>
          <span className="font-display font-bold text-lg text-foreground">SuperService</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link to="/#categories" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</Link>
          {user && (
            <Link to={dashboardPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground capitalize">{role}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-1" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log In</Button>
              </Link>
              <Link to="/register">
                <Button variant="hero" size="sm" className="rounded-lg">Sign Up</Button>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden glass border-t border-border px-4 py-4 space-y-3">
          <Link to="/" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Home</Link>
          <Link to="/#categories" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Services</Link>
          {user ? (
            <>
              <Link to={dashboardPath} className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Dashboard</Link>
              <Button variant="ghost" size="sm" onClick={() => { handleSignOut(); setOpen(false); }}>Sign Out</Button>
            </>
          ) : (
            <div className="flex gap-3 pt-2">
              <Link to="/login" onClick={() => setOpen(false)}><Button variant="ghost" size="sm">Log In</Button></Link>
              <Link to="/register" onClick={() => setOpen(false)}><Button variant="hero" size="sm">Sign Up</Button></Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
