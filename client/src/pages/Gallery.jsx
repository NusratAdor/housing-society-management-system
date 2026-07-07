// client/src/pages/Gallery.jsx
//
// Same fixes as CommunityGallery.jsx:
//   - Fixed overlay height removed -> auto-height by content
//   - Description line-clamp removed -> full text, no truncation
//   - Icon delay-200 added so its animation is visibly perceptible
//     after the box slide, not finishing invisibly early
//
// All existing features untouched.

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate }                from "react-router-dom";
import { motion }                     from "framer-motion";
import { ArrowRight, CalendarDays }   from "lucide-react";
import Title                          from "../components/Title";
import Breadcrumb                     from "../components/Breadcrumb";
import { formatDate }                 from "../utils/formatDate.js";
import { useAppContext }              from "../context/AppContext";
import usePageTitle                   from "../hooks/usePageTitle";
import { useTranslation }             from "react-i18next";

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

  const crumbs = [
    { label: "Home",    href: "/" },
    { label: t("title")           },
  ];

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        <Breadcrumb crumbs={crumbs} />

        <Title
          title={t("title")}
          subTitle={t("subtitle")}
        />

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 text-gray-600" />
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((it, idx) => (
              <motion.div
                key={it._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => navigate(`/gallery/${it._id}`)}
                className="relative group rounded-2xl overflow-hidden cursor-pointer
                           shadow-sm hover:shadow-lg transition-shadow duration-300"
              >
                <img
                  src={it.image}
                  alt={it.title}
                  className="w-full h-[280px] object-cover
                             group-hover:scale-105
                             transition-transform duration-500 ease-out"
                />

                {/* Overlay — auto-height, no fixed cap, no truncation */}
                <div
                  className="absolute bottom-0 left-0 right-0
                             flex items-center gap-3 px-4 py-4
                             translate-y-full group-hover:translate-y-0
                             transition-transform duration-[500ms] ease-out"
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

                  {/* Icon — delay-200, duration-400 so the appear
                      animation is clearly perceptible                    */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full
                               border border-white/25 flex items-center justify-center
                               opacity-0 scale-50
                               group-hover:opacity-100 group-hover:scale-100
                               group-hover:bg-white/15 group-hover:border-white/70
                               transition-all duration-400 ease-out delay-200"
                  >
                    <ArrowRight
                      size={16}
                      strokeWidth={2}
                      className="text-white/70 transition-all duration-300
                                 group-hover:text-white
                                 group-hover:translate-x-0.5"
                    />
                  </div>
                </div>
              </motion.div>
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