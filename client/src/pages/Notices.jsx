// pages/Notices.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Title from "../components/Title";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { formatDate } from "../utils/formatDate"; // <-- ADDED

const Notices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notices`
        );
        if (response.data.success) {
          setNotices(response.data.notices);
        } else {
          toast.error(response.data.message || "Failed to load notices");
        }
      } catch (error) {
        toast.error("Error loading notices. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, []);

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Title
          title="Notices"
          subTitle="Stay updated with the latest community announcements."
        />

        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="animate-spin h-8 w-8 text-gray-600" />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {notices.map((notice, index) => (
              <motion.div
                key={notice._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300"
              >
                <Link to={`/notices/${notice._id}`} className="block p-4">
                  {notice.image ? (
                    <img
                      src={notice.image}
                      alt={notice.title}
                      className="h-40 w-full object-cover rounded-md mb-4"
                    />
                  ) : (
                    <div className="h-40 w-full bg-gray-100 rounded-md mb-4 flex items-center justify-center">
                      <span className="text-gray-400 font-outfit">No Image</span>
                    </div>
                  )}
                  <h3 className="font-playfair text-lg font-semibold text-gray-800">
                    {notice.title}
                  </h3>
                  <p className="text-gray-600 font-outfit text-sm">
                    {formatDate(notice.date)} | Posted: {formatDate(notice.createdAt)}
                  </p>
                  <p className="text-gray-600 font-outfit text-sm mt-2 line-clamp-2">
                    {notice.summary}
                  </p>
                  <p className="text-gray-600 font-outfit text-sm mt-1 line-clamp-3">
                    {notice.content}
                  </p>
                  <span className="text-[var(--color-primary)] font-outfit text-sm mt-2 inline-block hover:underline">
                    Read More
                  </span>
                </Link>
              </motion.div>
            ))}
            {notices.length === 0 && (
              <p className="text-gray-500 font-outfit">No notices available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notices;