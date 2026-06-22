// client/src/i18n/index.js
//
// Loads namespaced JSON files instead of one flat inline object.
// Keys are semantic (navbar.dashboard) not English sentences.
// Benefit: English wording can be edited freely without orphaning
// Bengali translations, because the key itself never changes.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enNavbar    from "./locales/en/navbar.json";
import enDashboard from "./locales/en/dashboard.json";
import enOverview  from "./locales/en/overview.json";
import enPayment   from "./locales/en/payment.json";
import enProfile   from "./locales/en/profile.json";
import enNotices   from "./locales/en/notices.json";
import enFaqs      from "./locales/en/faqs.json";

import bnNavbar    from "./locales/bn/navbar.json";
import bnDashboard from "./locales/bn/dashboard.json";
import bnOverview  from "./locales/bn/overview.json";
import bnPayment   from "./locales/bn/payment.json";
import bnProfile   from "./locales/bn/profile.json";
import bnNotices   from "./locales/bn/notices.json";
import bnFaqs      from "./locales/bn/faqs.json";
import enGallery from "./locales/en/gallery.json";
import enContact from "./locales/en/contact.json";
import bnGallery from "./locales/bn/gallery.json";
import bnContact from "./locales/bn/contact.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        navbar:    enNavbar,
        dashboard: enDashboard,
        overview:  enOverview,
        payment:   enPayment,
        profile:   enProfile,
        notices:   enNotices,
        faqs:      enFaqs,
        gallery: enGallery, 
        contact: enContact
      },
      bn: {
        navbar:    bnNavbar,
        dashboard: bnDashboard,
        overview:  bnOverview,
        payment:   bnPayment,
        profile:   bnProfile,
        notices:   bnNotices,
        faqs:      bnFaqs,
        gallery: bnGallery, 
        contact: bnContact
      },
    },
    // Default namespace — t("key") without a ns arg looks here first
    defaultNS: "dashboard",
    ns: ["navbar", "dashboard", "overview", "payment", "profile", "notices", "faqs", "gallery", "contact"],
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;