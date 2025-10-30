// pages/NoticeDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Title from "../components/Title";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NoticeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotice = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notices/${id}`
        );
        if (response.data.success) {
          setNotice(response.data.notice);
        } else {
          toast.error(response.data.message || "Failed to load notice");
          navigate("/notices");
        }
      } catch (error) {
        toast.error("Error loading notice. Please try again.");
        navigate("/notices");
      } finally {
        setLoading(false);
      }
    };
    fetchNotice();
  }, [id, navigate]);

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {loading ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="animate-spin h-8 w-8 text-gray-600" />
          </div>
        ) : !notice ? (
          <p className="text-gray-500 font-outfit">Notice not found.</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/notices")}
              className="mb-6 text-[var(--color-primary)]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Notices
            </Button>
            <Title
              title={notice.title}
              subTitle={`Posted on ${new Date(notice.createdAt).toLocaleDateString()}`}
            />
            <div className="mt-8">
              {notice.image && (
                <img
                  src={notice.image}
                  alt={notice.title}
                  className="w-full h-[400px] object-cover rounded-2xl shadow-sm"
                />
              )}
              <div className="mt-6">
                <p className="text-gray-600 font-outfit text-sm mb-2">
                  <strong>Date:</strong> {notice.date}
                </p>
                <p className="text-gray-600 font-outfit text-base mb-4">{notice.summary}</p>
                <p className="text-gray-700 font-outfit text-base leading-relaxed">{notice.content}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default NoticeDetail;