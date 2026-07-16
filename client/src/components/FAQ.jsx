// client/src/components/FAQ.jsx
//
// CHANGE (this pass): heading rebuilt to match the pattern already
// established by SocietyIntroduction / NoticesPreview / CommunityGallery
// — pill badge (icon + label) + bold Outfit heading with one emerald-
// highlighted word + gray-500 subtitle. Previously used the shared
// <Title/> component, which didn't carry that pattern and stood out as
// visually inconsistent from the rest of the home page.
//
// Also aligned two smaller things with the rest of the site:
//   - Question text: font-playfair -> font-outfit (font-playfair
//     currently resolves to Outfit anyway per index.css, so this is
//     the same fix already applied to Hero.jsx — using the real
//     Tailwind classes directly instead of the legacy serif class name).
//   - Chevron color: var(--color-primary) (blue) -> emerald-600, to
//     match the accent color used everywhere else on the home page.
//
// Added the same border-t border-gray-100 section-divider used across
// every other homepage section (see Home.jsx section boundaries).
//
// The accordion open/close animation itself — the max-h/opacity/
// translate-y transition — is completely UNTOUCHED. Only typography
// and the heading block changed.

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
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
          Help Center
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
        >
          Frequently Asked <span className="text-emerald-600">Questions</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-500 text-sm md:text-base max-w-xl mb-12"
        >
          Common questions from our community, answered by our admins.
        </motion.p>

        {loading ? (
          <FAQSkeleton />
        ) : faqs.length === 0 ? (
          <p className="text-sm text-gray-400 font-outfit">
            No FAQs published yet.
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

                {/*
                  Animation UNCHANGED — see original file header for the
                  full explanation of why max-h/opacity/translate-y are
                  used together. Not touched in this pass.
                */}
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