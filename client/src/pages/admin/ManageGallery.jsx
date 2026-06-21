// pages/admin/ManageGallery.jsx
import React, { useState, useEffect } from "react";
import Title from "../../components/Title";
import { motion } from "framer-motion";
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

import { useAppContext } from "../../context/AppContext";

import usePageTitle from "../../hooks/usePageTitle";

const ManageGallery = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Gallery");

  const [gallery, setGallery] = useState([]);
  const [formData, setFormData] = useState({
    _id: null,
    title: "",
    description: "",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteTitle, setDeleteTitle] = useState("");

  // ---------- FETCH ----------
  const fetchGallery = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get(
        `/api/gallery`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) setGallery(data.gallery);
    } catch (err) {
      toast.error("Failed to load gallery");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  // ---------- HANDLERS ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImage = (e) => {
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
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      if (formData.image) payload.append("image", formData.image);

      let res;
      if (formData._id) {
        res = await axios.put(
          `/api/gallery/${formData._id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        res = await axios.post(
          `/api/gallery`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (res.data.success) {
        toast.success(res.data.message);
        fetchGallery();
        setFormData({ _id: null, title: "", description: "", image: null });
        setImagePreview("");
      }
    } catch (err) {
      toast.error("Error saving item");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      _id: item._id,
      title: item.title,
      description: item.description,
      image: null,
    });
    setImagePreview(item.image);
  };

  const openDelete = (id, title) => {
    setDeleteId(id);
    setDeleteTitle(title);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.delete(
        `/api/gallery/${deleteId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setGallery((prev) => prev.filter((i) => i._id !== deleteId));
        toast.success("Gallery item deleted");
      }
    } catch (err) {
      toast.error("Delete failed");
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
      setDeleteTitle("");
    }
  };

  // ---------- UI ----------
  return (
    <div className="w-full bg-white">
      <Title title="Manage Gallery" subTitle="Add, edit or remove community gallery items." />

      {loading && (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="animate-spin h-8 w-8 text-gray-600" />
        </div>
      )}

      {!loading && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ----- FORM ----- */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white border border-gray-300 rounded-md p-6 shadow-sm"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
              {formData._id ? "Edit Item" : "Add New Item"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Title</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Image</label>
                <input type="file" accept="image/*" onChange={handleImage} className="w-full p-2 border rounded-md" />
                {imagePreview && <img src={imagePreview} alt="prev" className="mt-2 h-28 rounded-md w-full object-cover" />}
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving…" : formData._id ? "Update" : "Add"}
                </Button>
                {formData._id && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setFormData({ _id: null, title: "", description: "", image: null });
                      setImagePreview("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </motion.div>

          {/* ----- LIST ----- */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 bg-white border border-gray-300 rounded-md p-6 shadow-sm"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Gallery List</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gallery.map((item) => (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)] transition-all"
                >
                  <img src={item.image} alt={item.title} className="h-32 w-full object-cover rounded-md mb-2" />
                  <h4 className="font-playfair text-base font-semibold text-gray-800">{item.title}</h4>
                  <p className="text-gray-600 font-outfit text-sm line-clamp-2">{item.description}</p>

                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openDelete(item._id, item.title)} className="text-red-500">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </motion.div>
              ))}
              {gallery.length === 0 && <p className="text-gray-500 col-span-2">No items yet.</p>}
            </div>
          </motion.div>
        </div>
      )}

      {/* ----- DELETE DIALOG ----- */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gallery Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete “{deleteTitle}”? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageGallery;