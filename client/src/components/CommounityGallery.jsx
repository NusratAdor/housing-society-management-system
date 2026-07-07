// client/src/components/CommunityGallery.jsx
//
// CHANGE: card markup extracted to the new shared GalleryCard component
// — same reasoning as Gallery.jsx (mobile scroll-hook can't live inside
// a .map() callback directly).
//
// Header/button positioning, title centering, grid gap — all untouched
// from the last approved version.

import React, { useEffect, useState } from "react";
import Title             from "./Title";
import GalleryCard       from "./GalleryCard";
import { motion }        from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { toast }         from "react-hot-toast";
import { ArrowRight }    from "lucide-react";

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

        <div className="relative">
          <Title
            title="Gallery"
            subTitle="Moments from our community events and activities."
          />
          <ViewAllButton className="hidden md:flex absolute right-0 top-2" />
        </div>

        <div className="flex md:hidden justify-center mt-4">
          <ViewAllButton />
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6"
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