// pages/admin/ManageNotices.jsx
import React, { useState, useEffect } from "react";
import Title from "../../components/Title";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ManageNotices = () => {
  const { getToken } = useAuth();
  const [notices, setNotices] = useState([]);
  const [formData, setFormData] = useState({
    _id: null,
    title: "",
    date: "",
    summary: "",
    content: "",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteNoticeId, setDeleteNoticeId] = useState(null);
  const [deleteNoticeTitle, setDeleteNoticeTitle] = useState("");

  // Fetch notices
  const fetchNotices = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notices`,
        { headers: { Authorization: `Bearer ${token}` } }
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

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("date", formData.date);
      formDataToSend.append("summary", formData.summary);
      formDataToSend.append("content", formData.content);
      if (formData.image) {
        formDataToSend.append("image", formData.image);
      }

      if (formData._id) {
        // Update notice
        const response = await axios.put(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notices/${formData._id}`,
          formDataToSend,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          toast.success(response.data.message);
          fetchNotices();
        } else {
          toast.error(response.data.message || "Failed to update notice");
        }
      } else {
        // Create notice
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notices`,
          formDataToSend,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          toast.success(response.data.message);
          fetchNotices();
        } else {
          toast.error(response.data.message || "Failed to create notice");
        }
      }

      setFormData({ _id: null, title: "", date: "", summary: "", content: "", image: null });
      setImagePreview("");
    } catch (error) {
      toast.error("Error saving notice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (notice) => {
    setFormData({
      _id: notice._id,
      title: notice.title,
      date: notice.date,
      summary: notice.summary,
      content: notice.content,
      image: null,
    });
    setImagePreview(notice.image || "");
  };

  const handleDelete = (id, title) => {
    setDeleteNoticeId(id);
    setDeleteNoticeTitle(title);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not found");

      const response = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/notices/${deleteNoticeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Update local state immediately
        setNotices((prevNotices) => {
          const updatedNotices = prevNotices.filter((notice) => notice._id !== deleteNoticeId);
          console.log("Updated notices:", updatedNotices); // Debug log
          return updatedNotices;
        });
        toast.success(response.data.message || "Notice deleted successfully");
      } else {
        toast.error(response.data.message || "Failed to delete notice");
      }
    } catch (error) {
      console.error("Delete error:", error.message); // Debug log
      toast.error("Error deleting notice. Please try again.");
    } finally {
      setShowDeleteDialog(false);
      setDeleteNoticeId(null);
      setDeleteNoticeTitle("");
    }
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage Notices"
        subTitle="Create, edit, or remove community notices."
      />
      {loading && (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="animate-spin h-8 w-8 text-gray-600" />
        </div>
      )}
      {!loading && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-gray-300 rounded-md p-6 shadow-sm"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
              {formData._id ? "Edit Notice" : "Add New Notice"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Summary</label>
                <input
                  type="text"
                  name="summary"
                  value={formData.summary}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Content</label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="4"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-2 h-24 rounded-md" />
                )}
              </div>
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 hover:bg-blue-700"
                >
                  {loading ? "Saving..." : formData._id ? "Update" : "Add"}
                </Button>
                {formData._id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData({ _id: null, title: "", date: "", summary: "", content: "", image: null });
                      setImagePreview("");
                    }}
                    className="text-gray-600 border-gray-300"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 bg-white border border-gray-300 rounded-md p-6 shadow-sm"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Notice List</h3>
            <div className="space-y-4">
              {notices.map((notice) => (
                <motion.div
                  key={notice._id}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)] transition-all"
                >
                  <div className="flex gap-4">
                    {notice.image && (
                      <img src={notice.image} alt={notice.title} className="h-24 w-24 object-cover rounded-md" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-playfair text-base font-semibold text-gray-800">{notice.title}</h4>
                      <p className="text-gray-600 font-outfit">{notice.date} | Created: {new Date(notice.createdAt).toLocaleDateString()}</p>
                      <p className="text-gray-600 font-outfit">{notice.summary}</p>
                      <p className="text-gray-600 font-outfit mt-1">{notice.content}</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(notice)}
                          className="text-[var(--color-primary)]"
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(notice._id, notice.title)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {notices.length === 0 && (
                <p className="text-gray-500 font-outfit">No notices available.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the notice "{deleteNoticeTitle}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageNotices;