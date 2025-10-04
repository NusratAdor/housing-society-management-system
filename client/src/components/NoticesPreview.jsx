import React from "react";
import { useNavigate } from "react-router-dom";
import { noticesDummyData } from "../assets/assets";
import Title from "./Title";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const fadeUpVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
  }),
};

const NoticesPreview = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <Title
            title="Community Notices"
            subTitle="Stay informed about the latest announcements and events in your society"
          />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-14 w-full">
          {noticesDummyData.slice(0, 3).map((notice, i) => (
            <motion.div
              key={notice._id}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUpVariant}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col overflow-hidden"
            >
              <div className="relative overflow-hidden group">
                <img
                  src={notice.image}
                  alt={notice.title}
                  className="w-full h-[220px] object-cover rounded-t-2xl transform group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute bottom-2 right-2 bg-white/80 text-gray-800 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                  {notice.date}
                </span>
              </div>

              <div className="p-4 flex flex-col justify-between flex-grow text-left">
                <h3 className="text-lg font-semibold text-gray-800 hover:text-blue-700 transition-colors">
                  {notice.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {notice.summary}
                </p>
                <button
                  onClick={() => navigate(`/notices/${notice._id}`)}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-all group"
                >
                  Read More
                  <ArrowRight className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          viewport={{ once: true, amount: 0.3 }}
          onClick={() => {
            navigate("/notices");
            window.scrollTo(0, 0);
          }}
          className="mt-14 px-5 py-2 text-sm font-medium border border-gray-300 rounded-full bg-white hover:bg-gray-100 transition-all cursor-pointer shadow-sm"
        >
          View All Notices
        </motion.button>
      </div>
    </div>
  );
};

export default NoticesPreview;
