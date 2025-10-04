import React from "react";
import { Link } from "react-router-dom";
import { Users, Bell, MessageSquare, Image, Plus } from "lucide-react";
import {
  membersDummyData,
  noticesDummyData,
  faqsDummyData,
  galleryDummyData,
} from "../../assets/assets";
import Title from "../../components/Title";
import { motion } from "framer-motion";

const Dashboard = () => {
  const stats = [
    {
      name: "Members",
      count: membersDummyData.length,
      icon: <Users className="h-6 w-6" />,
      path: "/admin/manage-members",
      color: "bg-blue-100",
    },
    {
      name: "Notices",
      count: noticesDummyData.length,
      icon: <Bell className="h-6 w-6" />,
      path: "/admin/manage-notices",
      color: "bg-green-100",
    },
    {
      name: "FAQs",
      count: faqsDummyData.length,
      icon: <MessageSquare className="h-6 w-6" />,
      path: "/admin/manage-faqs",
      color: "bg-yellow-100",
    },
    {
      name: "Gallery Items",
      count: galleryDummyData.length,
      icon: <Image className="h-6 w-6" />,
      path: "/admin/manage-gallery",
      color: "bg-purple-100",
    },
  ];

  const recentActivity = [
    {
      type: "Notice",
      content: `Posted: ${noticesDummyData[0]?.title || "None"}`,
      date: noticesDummyData[0]?.createdAt || "N/A",
    },
    {
      type: "Member",
      content: `New: ${membersDummyData.at(-1)?.name || "None"}`,
      date: membersDummyData.at(-1)?.createdAt || "N/A",
    },
    {
      type: "FAQ",
      content: `Answered: ${faqsDummyData[0]?.question || "None"}`,
      date: faqsDummyData[0]?.answeredAt || "N/A",
    },
    {
      type: "Gallery",
      content: `Added: ${galleryDummyData[0]?.title || "None"}`,
      date: galleryDummyData[0]?.date || "N/A",
    },
  ];

  return (
    <div className="w-full bg-white min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Title */}
        <div className="mb-10">
          <Title
            title="Admin Dashboard"
            subTitle="Manage your housing society efficiently."
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={stat.path}
                className={`flex items-center gap-4 p-6 ${stat.color} border border-gray-300 rounded-lg shadow-sm hover:border-[var(--color-primary)] hover:shadow-md transition-all duration-300`}
              >
                <div className="text-[var(--color-primary)]">{stat.icon}</div>
                <div>
                  <h3 className="font-playfair text-lg font-semibold text-gray-800">
                    {stat.name}
                  </h3>
                  <p className="text-gray-600 font-outfit text-sm">
                    {stat.count} {stat.name}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm"
          >
            <h3 className="font-playfair text-xl font-semibold text-gray-800 mb-6">
              Recent Activity
            </h3>
            <ul className="space-y-4 font-outfit text-gray-700 text-sm">
              {recentActivity.map((activity, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-b-0"
                >
                  <span className="mt-1 text-[var(--color-primary)]">•</span>
                  <div>
                    <p>{activity.type}: {activity.content}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm"
          >
            <h3 className="font-playfair text-xl font-semibold text-gray-800 mb-6">
              Quick Actions
            </h3>
            <div className="flex flex-col gap-4 font-outfit text-[var(--color-primary)]">
              <Link
                to="/admin/manage-notices"
                className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded-md transition-all"
              >
                <Plus className="h-5 w-5" /> Add New Notice
              </Link>
              <Link
                to="/admin/manage-faqs"
                className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded-md transition-all"
              >
                <Plus className="h-5 w-5" /> Answer FAQ
              </Link>
              <Link
                to="/admin/manage-gallery"
                className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded-md transition-all"
              >
                <Plus className="h-5 w-5" /> Add Gallery Item
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
