// client/src/pages/Gallery.jsx
//
// REDESIGNED — hero banner matching Notices.jsx exactly (same
// background image, gradient overlay, light breadcrumb, bold heading
// with emerald highlight, subtitle). No search/filter bar here — that
// wasn't requested for Gallery, so this is just the hero portion of
// the pattern, not the full search-bar treatment.
//
//   - Old shared Breadcrumb.jsx + Title.jsx usage removed, replaced
//     with the same inline light breadcrumb variant used on Notices.jsx
//     and NoticeDetail.jsx (white text on dark hero, active crumb in
//     emerald-400).
//   - Heading: bold Outfit "Community Gallery" with emerald highlight
//     on "Gallery" — same treatment as "Community Notices".
//   - Subtitle still pulled from t("subtitle") — i18n integrity
//     preserved, not hardcoded.
//   - Grid, loading state, empty state, GalleryCard usage, data
//     fetching: UNCHANGED.

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import GalleryCard        from "../components/GalleryCard";
import { useAppContext }  from "../context/AppContext";
import usePageTitle       from "../hooks/usePageTitle";
import { useTranslation } from "react-i18next";

const Gallery = () => {
  const { axios }  = useAppContext();
  const navigate   = useNavigate();
  const { t }      = useTranslation("gallery");
  usePageTitle(t("title"));

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGallery = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/gallery");
      if (data.success) setItems(data.gallery);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  return (
    <div className="w-full bg-white min-h-screen">

      {/* ── Hero banner — same pattern as Notices.jsx ────────────────────── */}
      <div className="relative w-full h-[260px] md:h-[300px] overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')]
                     bg-cover bg-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b
                        from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8
                        h-full flex flex-col items-center justify-center
                        text-center">

          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center justify-center gap-1.5 text-base">
              <li>
                <Link
                  to="/"
                  className="text-white/70 hover:text-white
                             font-outfit font-medium transition-colors"
                >
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-semibold">
                  {t("title")}
                </span>
              </li>
            </ol>
          </nav>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-bold text-white mb-3"
          >
            Community <span className="text-emerald-400">Gallery</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/70 text-sm md:text-base max-w-lg mx-auto"
          >
            {t("subtitle")}
          </motion.p>
        </div>
      </div>

      {/* ── Gallery grid ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-12 pb-20">

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-2 border-gray-200
                            border-t-emerald-500 rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((it, idx) => (
              <GalleryCard
                key={it._id}
                item={it}
                index={idx}
                imageHeight="h-[280px]"
                onClick={() => navigate(`/gallery/${it._id}`)}
              />
            ))}

            {items.length === 0 && !loading && (
              <p className="col-span-full text-center text-gray-500 font-outfit">
                {t("empty")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;