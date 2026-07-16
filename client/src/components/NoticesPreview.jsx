// client/src/components/NoticesPreview.jsx
//
// CHANGE (this pass): background tint moved here from SocietyIntroduction
// (that section is back to plain white — see that file). Used a flat
// custom hex (#F3FBF8) rather than Tailwind's bg-emerald-50/40 —
// opacity-based fills are a blend of the color and whatever's behind
// them, so matching it exactly from SocietyIntroduction's wave divider
// would mean computing that blend by hand and hoping it's pixel-exact.
// A flat hex means the wave's fill and this section's background can
// just share the same literal value, with zero seam by construction.
//
// Heading text/subtitle change from the previous pass — unchanged here.
// Everything else — border-draw hover effect, accent bar, inline
// "Read more" link, ViewAllButton, data fetching — untouched.

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Megaphone, ArrowRight, Calendar } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";
import { formatDate } from "../utils/formatDate";

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" },
  }),
};

const ViewAllButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 font-outfit font-medium text-sm
               border border-emerald-500 text-emerald-600
               rounded-md px-4 py-2
               bg-transparent
               hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600
               hover:text-white hover:border-transparent hover:shadow-md
               transition-all duration-300 ease-out
               group"
  >
    View All Notices
    <ArrowRight
      className="w-3.5 h-3.5 transition-transform duration-300
                 group-hover:translate-x-0.5"
    />
  </button>
);

const NoticesPreview = () => {
  const { axios, navigate } = useAppContext();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/notices");
        if (response.data.success) {
          setNotices(response.data.notices);
        } else {
          toast.error(response.data.message || "Failed to load notices");
        }
      } catch {
        toast.error("Error loading notices. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, []);

  return (
    <div className="w-full py-20" style={{ backgroundColor: "#F3FBF8" }}>

      <style>{`
        .notice-card {
          position: relative;
          border-radius: 10px;
        }
        .notice-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 11px;
          border: 2px solid #10b981;
          clip-path: inset(0 100% 0 0);
          transition: clip-path 0.45s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          z-index: 1;
        }
        .notice-card:hover::before {
          clip-path: inset(0 0% 0 0);
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">

        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5
                     rounded-full text-xs font-semibold
                     bg-emerald-50 text-emerald-700
                     border border-emerald-200 mb-5"
        >
          <Megaphone size={13} strokeWidth={2} />
          Notice Board
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-3xl md:text-4xl font-bold
                     text-gray-900 mb-3"
        >
          Community <span className="text-emerald-600">Notices</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-500 text-sm md:text-base max-w-xl mb-12"
        >
          Everything happening around your community, in one place.
        </motion.p>

        {loading ? (
          <div className="flex justify-center items-center h-[20vh]">
            <div className="animate-spin h-8 w-8 border-2 border-gray-200
                            border-t-emerald-500 rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
                          gap-5 w-full">
            {notices.slice(0, 3).map((notice, i) => (
              <motion.div
                key={notice._id}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={fadeUpVariant}
                onClick={() => navigate(`/notices/${notice._id}`)}
                className="notice-card group bg-white border border-gray-200
                           text-left flex cursor-pointer
                           shadow-sm hover:shadow-md
                           transition-shadow duration-300 overflow-hidden"
              >
                <div className="w-[3px] flex-shrink-0 bg-emerald-400
                                transition-all duration-300
                                group-hover:bg-emerald-600" />

                <div className="flex flex-col flex-1 p-5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold
                                text-gray-400
                                uppercase tracking-wide mb-2.5">
                    <Calendar size={12} strokeWidth={2} />
                    {formatDate(notice.date || notice.createdAt)}
                  </p>

                  <h3 className="font-outfit text-gray-900 font-bold
                                 text-lg leading-snug line-clamp-2 mb-3
                                 group-hover:text-emerald-600
                                 transition-colors duration-300">
                    {notice.title}
                  </h3>

                  <div className="w-6 h-[2px] bg-gray-300 rounded-full mb-3" />

                  <p className="text-gray-500 text-sm leading-relaxed
                                line-clamp-2 mb-5 flex-1 font-outfit">
                    {notice.summary}
                  </p>

                  <span className="inline-flex items-center gap-1.5 text-sm
                                   font-semibold text-emerald-600
                                   group/link w-fit">
                    Read more
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-300
                                 group-hover/link:translate-x-1"
                    />
                  </span>
                </div>
              </motion.div>
            ))}

            {notices.length === 0 && (
              <p className="text-gray-400 font-outfit col-span-full">
                No notices available.
              </p>
            )}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <ViewAllButton
            onClick={() => { navigate("/notices"); window.scrollTo(0, 0); }}
          />
        </motion.div>

      </div>
    </div>
  );
};

export default NoticesPreview;