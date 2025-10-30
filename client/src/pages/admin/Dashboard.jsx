 // pages/admin/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Users, Bell, MessageSquare, Image, Plus, Trash2 } from "lucide-react";
import Title from "../../components/Title";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
const Dashboard = () => {
  const { getToken } = useAuth();
  const [memberCount, setMemberCount] = useState(0);
  const [noticeCount, setNoticeCount] = useState(0);
  const [galleryCount, setGalleryCount] = useState(0);
  const [faqsCount, setFaqsCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true); // Prevent animation on refresh
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error("Failed to get token");
      const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const [membersRes, noticesRes, galleryRes, pendingRes, notifRes] =
        await Promise.all([
          axios.get(`${baseURL}/api/admin/members`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${baseURL}/api/notices`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${baseURL}/api/gallery`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${baseURL}/api/faqs/pending`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${baseURL}/api/notifications`, {  // ← Correct endpoint
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
      if (membersRes.data.success) setMemberCount(membersRes.data.members.length);
      if (noticesRes.data.success) setNoticeCount(noticesRes.data.notices.length);
      if (galleryRes.data.success) setGalleryCount(galleryRes.data.gallery.length);
      if (pendingRes.data.success) setFaqsCount(pendingRes.data.pending.length);
      if (notifRes.data.success) {
        const recent = notifRes.data.notifications
          .filter((n) => ["Member", "Question"].includes(n.type))
          .slice(0, 5);
        setNotifications(recent);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      isFirstLoad.current = false; // Disable animation after first load
    }
  };
  const handleClearNotifications = async () => {
    try {
      const token = await getToken();
      const res = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notifications`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setNotifications([]);
        toast.success("Notifications cleared");
      }
    } catch {
      toast.error("Failed to clear notifications");
    }
  };
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [getToken]);
  const stats = [
    { name: "Members", count: memberCount, icon: <Users className="h-6 w-6" />, path: "/admin/manage-members", color: "bg-blue-100" },
    { name: "Notices", count: noticeCount, icon: <Bell className="h-6 w-6" />, path: "/admin/manage-notices", color: "bg-green-100" },
    { name: "FAQs", count: faqsCount, icon: <MessageSquare className="h-6 w-6" />, path: "/admin/manage-faqs", color: "bg-yellow-100" },
    { name: "Gallery Items", count: galleryCount, icon: <Image className="h-6 w-6" />, path: "/admin/manage-gallery", color: "bg-purple-100" },
  ];
  const recentActivity = notifications.map((n) => ({
    type: n.type,
    content: n.content,
    date: n.createdAt,
  }));
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );
  }
  return (
    <div className="w-full bg-white min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="mb-10">
          <Title title="Admin Dashboard" subTitle="Manage your housing society efficiently." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={isFirstLoad.current ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={stat.path}
                className={`flex items-center gap-4 p-6 ${stat.color} border border-gray-300 rounded-lg shadow-sm hover:border-[var(--color-primary)] hover:shadow-md transition-all duration-300`}
              >
                <div className="text-[var(--color-primary)]">{stat.icon}</div>
                <div>
                  <h3 className="font-playfair text-lg font-semibold text-gray-800">{stat.name}</h3>
                  <p className="text-gray-600 font-outfit text-sm">
                    {stat.count} {stat.name}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={isFirstLoad.current ? { opacity: 0, x: -20 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-playfair text-xl font-semibold text-gray-800">Recent Activity</h3>
              {recentActivity.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleClearNotifications} className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
              )}
            </div>
            <ul className="space-y-4 font-outfit text-gray-700 text-sm">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <motion.li
                    key={index}
                    initial={isFirstLoad.current ? { opacity: 0, x: -10 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-b-0"
                  >
                    <span className="mt-1 text-[var(--color-primary)]">•</span>
                    <div>
                      <p>
                        {activity.type}: {activity.content}
                        {activity.type === "Member" && <Badge variant="secondary" className="ml-2">New</Badge>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.li>
                ))
              ) : (
                <li className="text-gray-500">No recent activity.</li>
              )}
            </ul>
          </motion.div>
          {/* Quick Actions */}
          <motion.div
            initial={isFirstLoad.current ? { opacity: 0, x: 20 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm"
          >
            <h3 className="font-playfair text-xl font-semibold text-gray-800 mb-6">Quick Actions</h3>
            <div className="flex flex-col gap-4 font-outfit text-[var(--color-primary)]">
              <Link to="/admin/manage-notices" className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded-md transition-all">
                <Plus className="h-5 w-5" /> Add New Notice
              </Link>
              <Link to="/admin/manage-faqs" className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded-md transition-all">
                <Plus className="h-5 w-5" /> Answer FAQ
              </Link>
              <Link to="/admin/manage-gallery" className="flex items-center gap-2 hover:bg-blue-50 p-2 rounded-md transition-all">
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

