// client/src/components/GalleryCard.jsx
//
// CHANGE (this pass):
//   - Border radius reduced further: rounded-xl -> rounded-md, per
//     direct visual reference showing a small/subtle radius reads as
//     more modern than the larger rounding used previously. Applies
//     everywhere this card is used (Gallery.jsx list, CommunityGallery
//     homepage section) since it's the shared component.
//
// UNCHANGED from the previous pass: multi-image badge, font-outfit
// title, emerald-400 hover color, the circular icon swap effect and
// all its underlying reasoning, the mobile scroll-active fallback.

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Images } from "lucide-react";
import { formatDate } from "../utils/formatDate.js";
import useScrollActive from "../hooks/useScrollActive";

const GalleryCard = ({ item, onClick, imageHeight = "h-[300px]", index = 0 }) => {
  const [cardRef, isActive] = useScrollActive(0.5);

  const photoCount = item.images?.length || 0;

  return (
    <motion.div
      ref={cardRef}
      data-active={isActive}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={onClick}
      className="group relative rounded-md overflow-hidden cursor-pointer
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

      {/* Multi-image badge — only shown when there's more than one
          photo for this event.                                         */}
      {photoCount > 1 && (
        <div className="absolute top-3 right-3 flex items-center gap-1
                        px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
          <Images className="h-3 w-3 text-white" strokeWidth={2} />
          <span className="text-white text-[11px] font-semibold">
            {photoCount}
          </span>
        </div>
      )}

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
          <p className="font-outfit text-white font-bold text-lg
                        leading-snug
                        transition-colors duration-500
                        group-hover:text-emerald-400
                        group-data-[active=true]:text-emerald-400">
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

        {/* Appear/disappear wrapper — desktop hover OR mobile scroll-active */}
        <div
          className="opacity-0 scale-50
                     transition-all duration-400 ease-out delay-200
                     group-hover:opacity-100 group-hover:scale-100
                     group-data-[active=true]:opacity-100 group-data-[active=true]:scale-100"
        >
          <div className="group/icon w-9 h-9 relative flex-shrink-0
                          overflow-hidden rounded-full">
            <div
              className="absolute inset-0 rounded-full border border-white/30
                         flex items-center justify-center
                         transition-transform duration-300 ease-out
                         group-hover/icon:translate-x-full"
            >
              <ArrowRight size={16} strokeWidth={2} className="text-white/80" />
            </div>

            <div
              className="absolute inset-0 rounded-full
                         bg-gradient-to-r from-emerald-500 to-teal-600
                         -translate-x-full
                         flex items-center justify-center
                         transition-transform duration-300 ease-out
                         group-hover/icon:translate-x-0"
            >
              <ArrowRight size={16} strokeWidth={2} className="text-white" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GalleryCard;