// src/i18n/index.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Translation files
const resources = {
  en: {
    translation: {
      // Navbar
      Home: "Home",
      Notices: "Notices",
      Gallery: "Gallery",
      FAQs: "FAQs",
      Contact: "Contact",
      "Admin Panel": "Admin Panel",
      Dashboard: "Dashboard",
      "Create Profile": "Create Profile",
      "Sign In": "Sign In",
      "Government Officer's Housing Society (GOHS)": "Government Officer's Housing Society (GOHS)",
      "Connect with your community, manage your membership, track payments, view notices, and stay updated — all in one secure platform designed for our 500+ society members.":
        "Connect with your community, manage your membership, track payments, view notices, and stay updated — all in one secure platform designed for our 500+ society members.",
      "Join or Log In to Get Started": "Join or Log In to Get Started",

      // Add more keys as needed
    },
  },
  bn: {
    translation: {
      Home: "হোম",
      Notices: "নোটিস",
      Gallery: "গ্যালারি",
      FAQs: "প্রশ্নোত্তর",
      Contact: "যোগাযোগ",
      "Admin Panel": "অ্যাডমিন প্যানেল",
      Dashboard: "ড্যাশবোর্ড",
      "Create Profile": "প্রোফাইল তৈরি",
      "Sign In": "সাইন ইন",
      "Government Officer's Housing Society (GOHS)": "সরকারি কর্মকর্তাদের আবাসন সমিতি (GOHS)",
      "Connect with your community, manage your membership, track payments, view notices, and stay updated — all in one secure platform designed for our 500+ society members.":
        "আপনার সম্প্রদায়ের সাথে সংযোগ করুন, সদস্যপদ ব্যবস্থাপনা করুন, পেমেন্ট ট্র্যাক করুন, নোটিস দেখুন এবং আপডেট থাকুন — আমাদের ৫০০+ সদস্যের জন্য তৈরি একটি নিরাপদ প্ল্যাটফর্মে।",
      "Join or Log In to Get Started": "শুরু করতে যোগ দিন বা লগইন করুন",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;