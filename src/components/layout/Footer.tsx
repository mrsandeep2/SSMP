import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ================= TYPES ================= */

type FooterLink = {
  label: string;
  to: string;
};

type FooterColumnProps = {
  title: string;
  links: FooterLink[];
};

type SocialLink = {
  label: string;
  url: string;
  icon: typeof Facebook;
};

/* ================= FOOTER COLUMN ================= */

const FooterColumn = ({ title, links }: FooterColumnProps) => (
  <div>
    <h4 className="font-display font-semibold text-purple-600 mb-6 text-lg">
      {title}
    </h4>

    <div className="flex flex-col gap-4">
      {links.map((link, index) => (
        <Link
          key={index}
          to={link.to}
          className="
            text-sm text-slate-500
            hover:text-cyan-500
            hover:scale-105
            active:scale-95
            transition-all duration-300
          "
        >
          {link.label}
        </Link>
      ))}
    </div>
  </div>
);

const formatCompact = (value: number) => new Intl.NumberFormat("en-IN").format(value);

const getSocialLinks = (): SocialLink[] => {
  const env = import.meta.env;

  const items: Array<SocialLink | null> = [
    env.VITE_SOCIAL_FACEBOOK ? { label: "Facebook", url: env.VITE_SOCIAL_FACEBOOK, icon: Facebook } : null,
    env.VITE_SOCIAL_TWITTER ? { label: "Twitter", url: env.VITE_SOCIAL_TWITTER, icon: Twitter } : null,
    env.VITE_SOCIAL_INSTAGRAM ? { label: "Instagram", url: env.VITE_SOCIAL_INSTAGRAM, icon: Instagram } : null,
    env.VITE_SOCIAL_LINKEDIN ? { label: "LinkedIn", url: env.VITE_SOCIAL_LINKEDIN, icon: Linkedin } : null,
  ];

  return items.filter(Boolean) as SocialLink[];
};

/* ================= MAIN FOOTER ================= */

const Footer = () => {
  const socialLinks = getSocialLinks();

  const { data: stats } = useQuery({
    queryKey: ["footer-live-stats"],
    queryFn: async () => {
      const [roles, bookings, reviews] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("reviews").select("rating"),
      ]);

      const roleRows = roles.data ?? [];
      const providerUserIds = new Set(roleRows.filter((r: any) => r.role === "provider").map((r: any) => r.user_id));
      const adminUserIds = new Set(roleRows.filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
      const providerCount = Array.from(providerUserIds).filter((userId) => !adminUserIds.has(userId)).length;

      const ratings = reviews.data ?? [];
      const avgRating = ratings.length > 0
        ? (ratings.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / ratings.length).toFixed(1)
        : "0.0";

      return {
        providers: providerCount,
        completedBookings: bookings.count ?? 0,
        avgRating,
      };
    },
  });

  const year = new Date().getFullYear();

  return (
    <footer className="relative py-16 bg-background">
      <div className="container px-6">
        <div
          className="
            relative rounded-2xl p-10
            bg-background/80 backdrop-blur-xl
            shadow-2xl
            border border-yellow-400 dark:border-white/10
          "
        >
          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">

            {/* Brand Section */}
            <div className="space-y-6">

              {/* Logo */}
              <div className="flex items-center gap-3">
                <div
                  className="
                    w-11 h-11 rounded-xl
                    bg-gradient-to-br from-purple-500 to-pink-500
                    flex items-center justify-center
                    shadow-lg
                  "
                >
                  <span className="text-white font-bold text-sm">SS</span>
                </div>

                <span className="font-display font-bold text-2xl text-foreground">
                  SuperService
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                Live platform numbers from verified usage.
                Track providers, completed bookings, and current user rating.
              </p>

              {/* Stats */}
              <div className="flex gap-6 text-sm">

                <div>
                  <p className="text-purple-500 font-semibold text-lg">{formatCompact(stats?.providers ?? 0)}</p>
                  <p className="text-slate-500">Professionals</p>
                </div>

                <div>
                  <p className="text-purple-500 font-semibold text-lg">{formatCompact(stats?.completedBookings ?? 0)}</p>
                  <p className="text-slate-500">Bookings</p>
                </div>

                <div>
                  <p className="text-purple-500 font-semibold text-lg">{stats?.avgRating ?? "0.0"}★</p>
                  <p className="text-slate-500">Rating</p>
                </div>

              </div>
            </div>

            {/* Columns */}

            <FooterColumn
              title="Platform"
              links={[
                { label: "Browse Services", to: "/services" },
                { label: "Become a Provider", to: "/register?role=provider" },
                { label: "Create Account", to: "/register" },
              ]}
            />

            <FooterColumn
              title="Company"
              links={[
                { label: "About", to: "/about" },
                { label: "Blog", to: "/blog" },
                { label: "Contact", to: "/contact" },
              ]}
            />

            <FooterColumn
              title="Support"
              links={[
                { label: "FAQ", to: "/faq" },
                { label: "Support Center", to: "/support" },
                { label: "Reset Password", to: "/reset-password" },
              ]}
            />

            {/* Social Column */}
            <div>

              <h4 className="font-display font-semibold text-purple-600 mb-6 text-lg">
                Social Media
              </h4>

              <div className="flex flex-col gap-4">

                {socialLinks.length === 0 && (
                  <p className="text-sm text-slate-500">No social links available.</p>
                )}

                {socialLinks.map((item) => {

                  const Icon = item.icon;

                  return (
                    <a
                      key={item.label}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        flex items-center gap-3
                        text-sm text-slate-500
                        hover:text-cyan-500
                        hover:scale-105
                        active:scale-95
                        transition-all duration-300
                      "
                    >
                      <div
                        className="
                          w-9 h-9
                          flex items-center justify-center
                          rounded-lg
                          border border-yellow-400/40
                          hover:bg-purple-500/10
                          transition-all duration-300
                        "
                      >
                        <Icon size={16} />
                      </div>

                      {item.label}

                    </a>
                  );

                })}

              </div>

            </div>

          </div>

          {/* Bottom Section */}

          <div
            className="
              mt-12 pt-6
              border-t border-yellow-400/30 dark:border-white/10
              flex flex-col md:flex-row
              justify-between items-center
              text-sm text-slate-500
            "
          >

            <p>© {year} SuperService. All rights reserved.</p>

            <div className="flex gap-6 mt-4 md:mt-0">

              <Link to="/privacy-policy" className="hover:text-cyan-500 transition-all">Privacy Policy</Link>
              <Link to="/terms-of-service" className="hover:text-cyan-500 transition-all">Terms of Service</Link>

            </div>

          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
