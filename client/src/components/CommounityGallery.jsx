// components/CommunityGallery.jsx
import React, { useEffect, useState } from "react";
import Title from "./Title";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { toast } from "react-hot-toast";
import { ArrowRight } from "lucide-react";   // <-- NEW

const container = { hidden: {}, show: { transition: { staggerChildren: 0.15 } } };
const card = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } };

const CommunityGallery = () => {
  const { axios, navigate } = useAppContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get(
          `/api/gallery`
        );
        if (data.success) setItems(data.gallery);
      } catch {
        toast.error("Failed to load gallery");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // ---- DATE FORMAT ----
  const formatDate = (iso) => {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;   // 14 Dec, 2025
  };

  if (loading)
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );

  return (
    <div className="w-full bg-slate-50 py-30">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <Title
            align="left"
            title="Gallery"
            subTitle="Relive the joy of our society’s events and celebrations through our gallery."
          />
          <button
            onClick={() => {
              navigate("/gallery");
              window.scrollTo(0, 0);
            }}
            className="group flex items-center gap-2 font-medium max-md:mt-12"
          >
            View All Events
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-14"
        >
          {items.slice(0, 4).map((i) => (
            <motion.div
              key={i._id}
              variants={card}
              onClick={() => navigate(`/gallery/${i._id}`)}
              className="relative group rounded-2xl overflow-hidden cursor-pointer border border-gray-200 shadow-sm hover:shadow-md transition-all"
            >
              <img
                src={i.image}
                alt={i.title}
                className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 flex flex-col justify-end">
                <p className="text-sm text-white/80">{formatDate(i.createdAt)}</p>
                <h3 className="text-lg font-semibold text-white">{i.title}</h3>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
export default CommunityGallery;