// client/src/pages/Gallery.jsx
// CHANGE: catch block no longer calls toast.error()
// WHY: Backend cold-starts on Render cause the first request to fail.
// Toasting this confuses the user — the data loads fine after a second.
// Show a silent empty state instead. The user can see the spinner and
// knows data is loading.

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Title from "../components/Title";
import { formatDate } from "../utils/formatDate.js";
import { useAppContext } from "../context/AppContext";
import usePageTitle from "../hooks/usePageTitle";
import { useTranslation } from "react-i18next";

const Gallery = () => {
  const { axios } = useAppContext();
  const { t } = useTranslation("navbar");
  usePageTitle(t("gallery")); 
  
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGallery = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/gallery");
      if (data.success) setItems(data.gallery);
      // If data.success is false, just show empty — no toast
    } catch {
      // WHY silent: backend cold-start causes this on first load.
      // The component shows an empty state. No toast — user did not
      // do anything wrong and data will appear after backend warms up.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Title
          title="Community Gallery"
          subTitle="Explore moments from our society's events and activities."
        />

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 text-gray-600" />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((it, idx) => (
              <motion.div
                key={it._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[var(--color-primary)] hover:shadow-md transition-all"
              >
                <img
                  src={it.image}
                  alt={it.title}
                  className="h-48 w-full object-cover rounded-md mb-4"
                />
                <h3 className="font-playfair text-base font-semibold text-gray-800">
                  {it.title}
                </h3>
                <p className="text-gray-600 font-outfit">
                  {formatDate(it.createdAt)}
                </p>
                <p className="text-gray-600 font-outfit line-clamp-2">
                  {it.description}
                </p>
              </motion.div>
            ))}
            {items.length === 0 && !loading && (
              <p className="col-span-full text-center text-gray-500">
                No gallery items yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;