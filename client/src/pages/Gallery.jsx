// client/src/pages/Gallery.jsx
//
// CHANGE: card markup extracted to the new shared GalleryCard component
// (client/src/components/GalleryCard.jsx). This was necessary to support
// the mobile scroll-triggered hover simulation, which requires a hook
// call (useScrollActive) per card — not possible directly inside a
// .map() callback per React's rules of hooks.
//
// All existing features (i18n, breadcrumb, silent catch, formatDate,
// usePageTitle, empty state, navigation to /gallery/:id) untouched.

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate }    from "react-router-dom";
import Title              from "../components/Title";
import Breadcrumb         from "../components/Breadcrumb";
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
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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