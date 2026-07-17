// client/src/components/CommunityGallery.jsx
//
// CHANGE (this pass):
//   - Old shared Title.jsx component replaced with the SAME inline
//     heading markup pattern used in NoticesPreview.jsx: bold Outfit
//     h2 with an emerald-highlighted word, plus a subtitle paragraph
//     with matching size/color/max-width.
//   - Heading text changed from "Gallery" to "Community Gallery"
//     (highlighting "Gallery" in emerald), paralleling "Community
//     Notices" — consistent naming convention across both homepage
//     sections now.
//   - THE ACTUAL SPACING FIX: the subtitle now carries mb-12, exactly
//     matching NoticesPreview's subtitle spacing before its content
//     grid. The old Title component was producing a visibly tighter
//     gap here than NoticesPreview's heading block — that mismatch is
//     what was circled in the screenshot. This wasn't a proportions/
//     padding tweak on the grid itself; it was this one margin value.
//   - ViewAllButton, its corner positioning, ArrowRight behavior, grid,
//     data fetching: UNCHANGED — the button was already reverted to
//     its correct simple form in the previous pass and isn't touched
//     again here.

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Images, ArrowRight } from "lucide-react";
import GalleryCard        from "./GalleryCard";
import { useAppContext }  from "../context/AppContext";
import { toast }          from "react-hot-toast";

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
    <div className="w-full py-20" style={{ backgroundColor: "#F3FBF8" }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Heading — matches NoticesPreview.jsx's pattern exactly:
            pill badge + bold Outfit + emerald-highlighted second word,
            subtitle with mb-12 for the same breathing room before the
            grid. Pill text: "Photo Album" — "Photo Wall" was rejected;
            this parallels "Notice Board" as a simple, short label,
            using the Images (photo-stack) icon rather than Camera,
            since it also matches the icon already used on the
            multi-photo badge on each card, for consistency.            */}
        <div className="relative flex flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5
                       rounded-full text-xs font-semibold
                       bg-emerald-50 text-emerald-700
                       border border-emerald-200 mb-5"
          >
            <Images size={13} strokeWidth={2} />
            Photo Album
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
          >
            Community <span className="text-emerald-600">Gallery</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-gray-500 text-sm md:text-base max-w-xl mb-12"
          >
            Moments from our community events and activities.
          </motion.p>

          <ViewAllButton className="hidden md:flex absolute right-0 top-12" />
        </div>

        <div className="flex md:hidden justify-center mt-2 mb-6">
          <ViewAllButton />
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {items.slice(0, 4).map((it, idx) => (
            <GalleryCard
              key={it._id}
              item={it}
              index={idx}
              imageHeight="h-[300px]"
              onClick={() => navigate(`/gallery/${it._id}`)}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default CommunityGallery;