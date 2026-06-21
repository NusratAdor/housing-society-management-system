// client/src/components/FAQSection.jsx
//
// CHANGE: Animation restored to previous smooth version.
// The previous version used translate-y + opacity + max-h together.
// Dropping translate-y removed the upward-slide motion that made it
// feel smooth — the answer just faded in/out with no directional movement.
// Restored: opacity-0 → opacity-100, -translate-y-2 → translate-y-0,
// max-h-0 → max-h-[300px], all with duration-500 ease-in-out.
// This matches the original FAQSection animation exactly.

import React, { useState, useEffect, useCallback } from "react";
import Title from "./Title";
import { ChevronDown, ChevronUp } from "lucide-react";
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
    <div className="w-full bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8
        flex flex-col items-center text-center">
        <Title
          title="Frequently Asked Questions"
          subTitle="Common questions from our community, answered by our admins."
        />

        {loading ? (
          <FAQSkeleton />
        ) : faqs.length === 0 ? (
          <p className="mt-12 text-sm text-gray-400 font-outfit">
            No FAQs published yet.
          </p>
        ) : (
          <div className="mt-12 w-full max-w-3xl">
            {faqs.map((faq, index) => (
              <div
                key={faq._id}
                className="border-b border-gray-200 py-4 cursor-pointer w-full"
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-playfair text-lg font-medium text-left">
                    {faq.question}
                  </h3>
                  {openIndex === index ? (
                    <ChevronUp
                      className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0"
                    />
                  ) : (
                    <ChevronDown
                      className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0"
                    />
                  )}
                </div>

                {/*
                  Animation explanation:
                  - max-h-0 → max-h-[300px]: controls the height transition.
                    CSS cannot animate height:auto so max-h is the standard
                    workaround. 300px gives ample room for any answer text.
                  - opacity-0 → opacity-100: fades the content in/out.
                  - -translate-y-2 → translate-y-0: 8px upward slide on open,
                    downward slide on close. This is the motion that made the
                    previous version feel smooth and directional.
                  - overflow-hidden: required so content doesn't spill out
                    while max-h is still animating toward 0 on close.
                  - duration-500 ease-in-out: matches original timing exactly.
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