import React from "react";
import Title from "../components/Title";
import { noticesDummyData } from "../assets/assets";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Notices = () => {
  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Title
          title="Notices"
          subTitle="Stay updated with the latest community announcements."
        />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {noticesDummyData.map((notice, index) => (
            <motion.div
              key={notice._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300"
            >
              <Link to={`/notices/${notice._id}`} className="block p-4">
                {notice.image && (
                  <img
                    src={notice.image}
                    alt={notice.title}
                    className="h-40 w-full object-cover rounded-md mb-4"
                  />
                )}
                <h3 className="font-playfair text-lg font-semibold text-gray-800">{notice.title}</h3>
                <p className="text-gray-600 font-outfit text-sm">{notice.date} | Posted: {new Date(notice.createdAt).toLocaleDateString()}</p>
                <p className="text-gray-600 font-outfit text-sm mt-2 line-clamp-2">{notice.summary}</p>
                <p className="text-gray-600 font-outfit text-sm mt-1 line-clamp-3">{notice.content}</p>
                <span className="text-[var(--color-primary)] font-outfit text-sm mt-2 inline-block hover:underline">
                  Read More
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Notices;