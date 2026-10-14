// client/src/components/FAQ.jsx
//
// i18n PASS — heading badge, title, subtitle and empty state now come
// from the "home" namespace (faq.*). The heading uses <Trans> with a
// named <highlight> tag.
//
// FAQ question/answer text is admin-authored data from the API and is
// displayed as returned (it is not UI copy).
//
// Accordion animation (max-h/opacity/translate-y), styling, section
// divider, data fetching — UNCHANGED.

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useAppContext } from "../context/AppContext";

const FAQSkeleton = () => (
  <div className="w-full max-w-3xl space-y-3 mt-12">
    {[1, 2, 3].map(i => (
      <div key={i} className="border-b border-gray-200 py-4">
        <div className="h-5 bg-gray-100 animate-pulse rounded w-3/4" />
      </div>
    ))}
  </div>
);

const FAQSection = () => {
  const { axios } = useAppContext();
  const { t } = useTranslation("home");
  const [faqs,      setFaqs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [openIndex, setOpenIndex] = useState(null);

  const fetchPublicFAQs = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/faqs/public");
      if (data.success) setFaqs(data.faqs ?? []);
    } catch {
      // Silent — backend cold-start safe
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => { fetchPublicFAQs(); }, [fetchPublicFAQs]);

  return (
    <div className="w-full bg-white py-20 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8
        flex flex-col items-center text-center">

        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5
                     rounded-full text-xs font-semibold
                     bg-emerald-50 text-emerald-700
                     border border-emerald-200 mb-5"
        >
          <HelpCircle size={13} strokeWidth={2} />
          {t("faq.badge")}
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
        >
          <Trans
            t={t}
            i18nKey="faq.title"
            components={{ highlight: <span className="text-emerald-600" /> }}
          />
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-500 text-sm md:text-base max-w-xl mb-12"
        >
          {t("faq.subtitle")}
        </motion.p>

        {loading ? (
          <FAQSkeleton />
        ) : faqs.length === 0 ? (
          <p className="text-sm text-gray-400 font-outfit">
            {t("faq.empty")}
          </p>
        ) : (
          <div className="w-full max-w-3xl">
            {faqs.map((faq, index) => (
              <div
                key={faq._id}
                className="group border-b border-gray-200 py-4 cursor-pointer w-full"
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-outfit text-lg font-semibold text-gray-900 text-left
                                 transition-colors duration-200 group-hover:text-emerald-600">
                    {faq.question}
                  </h3>
                  {openIndex === index ? (
                    <ChevronUp
                      className="w-5 h-5 text-emerald-600 flex-shrink-0"
                    />
                  ) : (
                    <ChevronDown
                      className="w-5 h-5 text-emerald-600 flex-shrink-0"
                    />
                  )}
                </div>

                <div
                  className={`
                    text-sm text-gray-600 mt-2 text-left overflow-hidden
                    transition-all duration-500 ease-in-out
                    ${openIndex === index
                      ? "opacity-100 max-h-[300px] translate-y-0"
                      : "opacity-0 max-h-0 -translate-y-2"
                    }
                  `}
                >
                  <p className="pb-2">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FAQSection;