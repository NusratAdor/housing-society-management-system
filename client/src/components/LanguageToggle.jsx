// src/components/LanguageToggle.jsx
//
// REDESIGN (4th pass): switched from the plain text/underline version
// to an actual toggle-switch control — a rounded-full track with a
// small capsule that slides between EN and বাং. This is structurally
// distinct from the Sign In / Admin Panel CTA (rounded-md rectangle,
// full-width label) even though the moving capsule reuses the same
// brand gradient — the *shape and interaction pattern* (a switch, not
// a button) is what keeps it from reading as a duplicate control.
//
// Structural approach otherwise UNCHANGED: still uses text-current /
// border-current so the track outline adapts to whatever text color
// its parent context sets (white on the transparent/hero navbar, dark
// once scrolled).

import { useTranslation } from "react-i18next";

const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";

  const toggleLang = () => i18n.changeLanguage(isEn ? "bn" : "en");

  return (
    <button
      onClick={toggleLang}
      aria-label="Toggle language"
      aria-pressed={!isEn}
      className="relative flex items-center w-[76px] h-8 rounded-full
        border border-current/25 bg-current/5 p-0.5
        transition-colors duration-200"
    >
      {/* Sliding capsule */}
      <span
        className={`absolute top-0.5 bottom-0.5 left-0.5 w-[36px] rounded-full
          bg-gradient-to-r from-slate-500 to-slate-600 shadow-sm
          transition-transform duration-300 ease-out ${
            isEn ? "translate-x-0" : "translate-x-[36px]"
          }`}
      />

      <span
        className={`relative z-10 flex-1 text-center text-[11px] font-semibold
          tracking-wide transition-colors duration-300 ${
            isEn ? "text-white" : "text-current/60"
          }`}
      >
        EN
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-[11px] font-semibold
          tracking-wide transition-colors duration-300 ${
            !isEn ? "text-white" : "text-current/60"
          }`}
      >
        বাং
      </span>
    </button>
  );
};

export default LanguageToggle;