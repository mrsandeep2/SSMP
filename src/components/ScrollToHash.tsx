import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const NAVBAR_OFFSET_PX = 80;

export default function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    // If there's no hash, don't override default behavior.
    if (!location.hash) return;

    const id = location.hash.replace("#", "");
    if (!id) return;

    // Wait for the next paint so the target section exists.
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;

      const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET_PX;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 0);

    return () => window.clearTimeout(t);
  }, [location.pathname, location.hash]);

  return null;
}

