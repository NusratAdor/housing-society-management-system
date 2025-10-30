// src/components/LanguageToggle.jsx
import { useTranslation } from "react-i18next";

const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const toggleLang = () => {
    const newLang = i18n.language === "en" ? "bn" : "en";
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 text-sm font-medium transition-all hover:bg-gray-50"
    >
      <span className={i18n.language === "en" ? "font-bold" : "opacity-60"}>
        EN
      </span>
      <span className="text-gray-400">|</span>
      <span className={i18n.language === "bn" ? "font-bold" : "opacity-60"}>
        বাং
      </span>
    </button>
  );
};

export default LanguageToggle;