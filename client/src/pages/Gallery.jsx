import React from "react";
import Title from "../components/Title";
import { galleryDummyData } from "../assets/assets";
import { motion } from "framer-motion";

const Gallery = () => {
  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Title
          title="Community Gallery"
          subTitle="Explore moments from our society’s events and activities."
        />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {galleryDummyData.map((item, index) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white border border-gray-200 rounded-md p-4 shadow-sm hover:border-[var(--color-primary)] hover:shadow-md transition-all"
            >
              <img
                src={item.image}
                alt={item.title}
                className="h-48 w-full object-cover rounded-md mb-4"
              />
              <h3 className="font-playfair text-base font-semibold text-gray-800">{item.title}</h3>
              <p className="text-gray-600 font-outfit">{item.date}</p>
              <p className="text-gray-600 font-outfit line-clamp-2">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Gallery;