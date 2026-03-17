import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

/* ================= TYPES ================= */

type FooterLink = {
  label: string;
  to: string;
};

type FooterColumnProps = {
  title: string;
  links: FooterLink[];
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

/* ================= MAIN FOOTER ================= */

const Footer = () => {
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
                India’s trusted marketplace for verified services.
                Book professionals instantly or grow your freelance career with us.
              </p>

              {/* Stats */}
              <div className="flex gap-6 text-sm">

                <div>
                  <p className="text-purple-500 font-semibold text-lg">10K+</p>
                  <p className="text-slate-500">Professionals</p>
                </div>

                <div>
                  <p className="text-purple-500 font-semibold text-lg">50K+</p>
                  <p className="text-slate-500">Bookings</p>
                </div>

                <div>
                  <p className="text-purple-500 font-semibold text-lg">4.8★</p>
                  <p className="text-slate-500">Rating</p>
                </div>

              </div>
            </div>

            {/* Columns */}

            <FooterColumn
              title="Platform"
              links={[
                { label: "Browse Services", to: "/" },
                { label: "Become a Provider", to: "/register?role=provider" },
                { label: "Enterprise", to: "/" },
              ]}
            />

            <FooterColumn
              title="Company"
              links={[
                { label: "About", to: "/about" },
                { label: "Careers", to: "/" },
                { label: "Blog", to: "/" },
              ]}
            />

            <FooterColumn
              title="Support"
              links={[
                { label: "Help Center", to: "/" },
                { label: "Trust & Safety", to: "/" },
                { label: "Contact", to: "/" },
              ]}
            />

            {/* Social Column */}
            <div>

              <h4 className="font-display font-semibold text-purple-600 mb-6 text-lg">
                Social Media
              </h4>

              <div className="flex flex-col gap-4">

                {[
                  { icon: Facebook, label: "Facebook" },
                  { icon: Twitter, label: "Twitter" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Linkedin, label: "LinkedIn" },
                ].map((item, index) => {

                  const Icon = item.icon;

                  return (
                    <button
                      key={index}
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

                    </button>
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

            <p>© 2026 SuperService. All rights reserved.</p>

            <div className="flex gap-6 mt-4 md:mt-0">

              <Link
                to="/"
                className="hover:text-cyan-500 transition-all"
              >
                Privacy Policy
              </Link>

              <Link
                to="/"
                className="hover:text-cyan-500 transition-all"
              >
                Terms of Service
              </Link>

            </div>

          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
