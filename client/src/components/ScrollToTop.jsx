// client/src/components/ScrollToTop.jsx
//
// Two exports:
//   ScrollRestorer   — mounts once in App.jsx, scrolls window to top
//                      on every route change. Fixes the issue where
//                      navigating to a new page preserves the scroll
//                      position of the previous page.
//   ScrollToTopButton — floating bottom-right button, visible only after
//                      the user scrolls down 300px. Clicking it smoothly
//                      scrolls back to the top.

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";

// ─── ScrollRestorer ────────────────────────────────────────────────────────
// Renders nothing visible. Watches pathname and scrolls to top on change.
// Must be placed inside <BrowserRouter> (so inside App.jsx, not main.jsx).

export const ScrollRestorer = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // setTimeout 0 defers the scroll until after React finishes the render
    // cycle for the new route. Without this, the scroll fires before the
    // new page content is painted, which can cause a flicker on slow renders.
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
};

// ─── ScrollToTopButton ────────────────────────────────────────────────────
// Floating button, bottom-right corner.
// Only appears after scrolling 300px down — invisible on short pages
// where it would be pointless, and doesn't obstruct content on load.

export const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1,   y: 0  }}
          exit={{    opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={scrollToTop}
          aria-label="Scroll to top"
          // z-40 keeps it below Clerk modals (z-50) and dropdowns (z-30+)
          // but above regular page content
          className="fixed bottom-6 right-6 z-40
            w-11 h-11 rounded-full
            bg-[var(--color-primary)] hover:bg-blue-700
            text-white shadow-lg hover:shadow-xl
            flex items-center justify-center
            transition-colors duration-200
            focus:outline-none focus:ring-2
            focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
};