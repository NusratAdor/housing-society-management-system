// client/src/components/GalleryCard.jsx
//
// Shared card used by both Gallery.jsx and CommunityGallery.jsx.
//
// WHY extracted into its own component: the mobile scroll-triggered
// "hover" simulation needs a per-card IntersectionObserver via
// useScrollActive(). Hooks cannot be called inside a .map() callback —
// React requires a stable hook call order, which a dynamic-length array
// can't guarantee. Giving each card its own component lets the hook live
// at that component's top level, called once per mounted instance —
// fully rules-of-hooks compliant.
//
// ICON ANIMATION (corrected per your description):
// Two full circle layers stacked with absolute inset-0, clipped to a
// circle by the parent's rounded-full + overflow-hidden:
//   Layer 1 (outline) — transparent bg, white arrow. Visible at rest.
//     On hover/active: slides out to the right (translate-x-full) and
//     exits.
//   Layer 2 (filled)  — white bg, blue arrow (site's --color-primary
//     blue, #2563EB). Sits off-screen left at rest (-translate-x-full).
//     On hover/active: slides in from the left to translate-x-0 and
//     STAYS there for as long as hover/active holds — not a one-shot
//     animation, a persistent swapped state.
// When hover/active ends, CSS transitions reverse automatically (this
// is inherent to how CSS transitions work — no extra code needed):
// Layer 2 slides back out to the left, Layer 1 slides back in from the
// right, restoring the original outlined state.
//
// TRIGGER SCOPES:
//   - Desktop: the icon swap is on a NAMED nested group (group/icon) —
//     it only triggers when the cursor is directly over the icon
//     circle, independent of the card-wide hover that controls the
//     overlay reveal.
//   - Mobile: there's no cursor to isolate just the icon, so the swap
//     is ALSO wired to the outer card's group-data-[active=true] (the
//     scroll-triggered state) — the whole animation (overlay + icon
//     swap) activates together as the card scrolls into view.

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays } from "lucide-react";
import { formatDate } from "../utils/formatDate.js";
import useScrollActive from "../hooks/useScrollActive";

const GalleryCard = ({ item, onClick, imageHeight = "h-[300px]", index = 0 }) => {
  const [cardRef, isActive] = useScrollActive(0.5);

  return (
    <motion.div
      ref={cardRef}
      data-active={isActive}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden cursor-pointer
                 shadow-sm hover:shadow-lg transition-shadow duration-300"
    >
      <img
        src={item.image}
        alt={item.title}
        className={`w-full ${imageHeight} object-cover block
                    transition-transform duration-[600ms] ease-out
                    group-hover:scale-105
                    group-data-[active=true]:scale-105`}
      />

      {/* Overlay — slides up on desktop hover OR mobile scroll-active */}
      <div
        className="absolute bottom-0 left-0 right-0
                   flex items-center gap-3 px-4 py-4
                   translate-y-full
                   transition-transform duration-[600ms] ease-out
                   group-hover:translate-y-0
                   group-data-[active=true]:translate-y-0"
        style={{ background: "rgba(20, 18, 16, 0.94)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-playfair text-white font-semibold text-lg
                        leading-snug
                        transition-colors duration-500
                        group-hover:text-[#5eead4]
                        group-data-[active=true]:text-[#5eead4]">
            {item.title}
          </p>

          {item.description && (
            <p className="font-outfit text-white/65 text-sm leading-relaxed mt-1">
              {item.description}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-1.5">
            <CalendarDays
              className="text-white/35 flex-shrink-0"
              size={11}
              strokeWidth={1.8}
            />
            <span className="font-outfit text-white/45 text-xs">
              {formatDate(item.createdAt)}
            </span>
          </div>
        </div>

        {/* Icon circle — outer opacity/scale/border keyed to CARD hover
            (desktop) or scroll-active (mobile), same as overlay above. */}
        <div
          className="group/icon flex-shrink-0 w-9 h-9 rounded-full
                     border border-white/30 overflow-hidden relative
                     opacity-0 scale-50
                     transition-all duration-400 ease-out delay-200
                     group-hover:opacity-100 group-hover:scale-100 group-hover:border-white/60
                     group-data-[active=true]:opacity-100 group-data-[active=true]:scale-100 group-data-[active=true]:border-white/60"
        >
          {/* Layer 1 — outline arrow. Visible at rest.
              Desktop: exits on DIRECT icon hover (group/icon).
              Mobile: exits together with card scroll-active (group,
              not group/icon — no cursor to isolate the icon on touch). */}
          <div
            className="absolute inset-0 flex items-center justify-center
                       transition-transform duration-300 ease-out
                       group-hover/icon:translate-x-full
                       group-data-[active=true]:translate-x-full"
          >
            <ArrowRight size={16} strokeWidth={2} className="text-white/80" />
          </div>

          {/* Layer 2 — filled white circle, blue arrow. Off-screen left
              at rest. Slides in and STAYS while hover/active holds.
              Reverses automatically on hover-end / scroll-out.          */}
          <div
            className="absolute inset-0 flex items-center justify-center
                       bg-white -translate-x-full
                       transition-transform duration-300 ease-out
                       group-hover/icon:translate-x-0
                       group-data-[active=true]:translate-x-0"
          >
            <ArrowRight size={16} strokeWidth={2} style={{ color: "#2563EB" }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GalleryCard;