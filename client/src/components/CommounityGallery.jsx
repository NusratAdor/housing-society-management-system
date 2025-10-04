import React from "react";
import { useNavigate } from "react-router-dom";
import { galleryDummyData, assets } from "../assets/assets";
import Title from "./Title";
import { motion } from "framer-motion";

// Animation variants
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const CommunityGallery = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-slate-50 py-30">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col">
        <div className="flex flex-col md:flex-row items-center justify-between w-full">
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
            className="group flex items-center gap-2 font-medium cursor-pointer max-md:mt-12"
          >
            View All Events
            <img
              src={assets.arrowIcon}
              alt="arrow-icon"
              className="group-hover:translate-x-1 transition-all"
            />
          </button>
        </div>

        {/* Animated Gallery Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-14 w-full"
        >
          {galleryDummyData.slice(0, 4).map((event) => (
            <motion.div
              variants={cardVariants}
              key={event._id}
              onClick={() => navigate(`/gallery/${event._id}`)}
              className="relative group rounded-2xl overflow-hidden cursor-pointer border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-[220px] object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 flex flex-col justify-end">
                <div>
                  <p className="text-sm text-white/80 mb-1">{event.date}</p>
                  <h3 className="text-lg font-semibold text-white">
                    {event.title}
                  </h3>
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
