// client/src/components/CommunityGallery.jsx
//
// FIXES:
//   - Button taken OUT of the vertical flow between title and grid.
//     Was: self-end inside a width-shrunk flex-col wrapper, adding its
//     own height (mt-4 + button height) before the grid's own mt-8 —
//     stacking up to a much bigger gap than Notices.jsx has.
//     Now: absolutely positioned in the top-right corner of a `relative`
//     wrapper on desktop (md+), so it adds ZERO extra height to the
//     title-to-grid flow.
//   - Grid gap from title: mt-8 -> mt-6, matching Notices.jsx exactly
//     (Notices uses `mt-6 grid ...` after its Title component).
//   - Mobile: button shown stacked below title (absolute positioning
//     would risk overlapping centered title text on narrow screens),
//     centered, only below the md breakpoint.
//   - All other features (card design, icon, hover states, overlay)
//     completely untouched from the last approved version.

import React, { useEffect, useState } from "react";
import Title             from "./Title";
import { motion }        from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { toast }         from "react-hot-toast";
import { ArrowRight, CalendarDays } from "lucide-react";
import { formatDate }    from "../utils/formatDate.js";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};
const card = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1    },
};

const CommunityGallery = () => {
  const { axios, navigate } = useAppContext();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get("/api/gallery");
        if (data.success) setItems(data.gallery);
      } catch {
        toast.error("Failed to load gallery");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading)
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );

  const ViewAllButton = ({ className = "" }) => (
    <button
      onClick={() => { navigate("/gallery"); window.scrollTo(0, 0); }}
      className={`flex items-center gap-2 font-outfit font-medium text-sm
                  border border-emerald-500 text-emerald-600
                  rounded-md px-4 py-2
                  bg-transparent
                  hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600
                  hover:text-white hover:border-transparent hover:shadow-md
                  transition-all duration-300 ease-out
                  group ${className}`}
    >
      View all
      <ArrowRight
        className="w-3.5 h-3.5 transition-transform duration-300
                   group-hover:translate-x-0.5"
      />
    </button>
  );

  return (
    <div className="w-full bg-slate-50 py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* relative wrapper — button is absolutely positioned inside
            this on desktop, so it adds NO height to the title-to-grid
            flow. Title stays centred and untouched by the button.       */}
        <div className="relative">
          <Title
            title="Gallery"
            subTitle="Moments from our community events and activities."
          />

          {/* Desktop: anchored to the section's actual right edge,
              vertically aligned near the top of the title block.
              Zero impact on vertical spacing below.                     */}
          <ViewAllButton className="hidden md:flex absolute right-0 top-2" />
        </div>

        {/* Mobile only: stacked below title, centered. Absolute
            positioning is skipped here to avoid overlapping centered
            title text on narrow screens.                                */}
        <div className="flex md:hidden justify-center mt-4">
          <ViewAllButton />
        </div>

        {/* mt-6 — matches Notices.jsx exactly (was mt-8) */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6"
        >
          {items.slice(0, 4).map((it) => (
            <motion.div
              key={it._id}
              variants={card}
              onClick={() => navigate(`/gallery/${it._id}`)}
              className="relative group rounded-2xl overflow-hidden cursor-pointer
                         shadow-sm hover:shadow-lg transition-shadow duration-300"
            >
              <img
                src={it.image}
                alt={it.title}
                className="w-full h-[300px] object-cover block
                           group-hover:scale-105
                           transition-transform duration-[600ms] ease-out"
              />

              <div
                className="absolute bottom-0 left-0 right-0
                           flex items-center gap-3 px-4 py-4
                           translate-y-full group-hover:translate-y-0
                           transition-transform duration-[600ms] ease-out"
                style={{ background: "rgba(20, 18, 16, 0.94)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-playfair text-white font-semibold text-lg
                                leading-snug
                                transition-colors duration-500
                                group-hover:text-[#5eead4]">
                    {it.title}
                  </p>

                  {it.description && (
                    <p className="font-outfit text-white/65 text-sm
                                  leading-relaxed mt-1">
                      {it.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <CalendarDays
                      className="text-white/35 flex-shrink-0"
                      size={11}
                      strokeWidth={1.8}
                    />
                    <span className="font-outfit text-white/45 text-xs">
                      {formatDate(it.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Icon circle — outer opacity/scale/fill still keyed to
                    the CARD hover (group-hover), exactly as before.
                    group/icon is a SEPARATE, nested hover trigger — it
                    only activates when the cursor is directly over this
                    circle, independent of the card-wide hover above it.  */}
                <div
                  className="group/icon flex-shrink-0 w-9 h-9 rounded-full
                             border border-white/25 flex items-center justify-center
                             overflow-hidden relative
                             opacity-0 scale-50
                             group-hover:opacity-100 group-hover:scale-100
                             group-hover:bg-white/15 group-hover:border-white/70
                             transition-all duration-400 ease-out delay-200"
                >
                  {/* Arrow 1 — visible at rest. On DIRECT icon hover it
                      slides up-right and fades out (exits).              */}
                  <ArrowRight
                    size={16}
                    strokeWidth={2}
                    className="absolute text-white/70
                               transition-all duration-300 ease-out
                               group-hover/icon:translate-x-4
                               group-hover/icon:-translate-y-4
                               group-hover/icon:opacity-0"
                  />
                  {/* Arrow 2 — pre-positioned off-screen bottom-left,
                      invisible at rest. On DIRECT icon hover it slides
                      into the exact center position the first arrow just
                      vacated (enters) — the classic "exchange" motion.   */}
                  <ArrowRight
                    size={16}
                    strokeWidth={2}
                    className="absolute text-white
                               -translate-x-4 translate-y-4 opacity-0
                               transition-all duration-300 ease-out
                               group-hover/icon:translate-x-0
                               group-hover/icon:translate-y-0
                               group-hover/icon:opacity-100"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default CommunityGallery;