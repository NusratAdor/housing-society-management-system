// pages/admin/ManageGallery.jsx
//
// CHANGE (this pass) — visual modernization only, zero functional
// changes from the previous multi-image version:
//   - File input: native browser "Choose Files / No file chosen" text
//     replaced with the same styled dropzone pattern already used in
//     ManageNotices.jsx (dashed border, Paperclip icon, hidden real
//     input underneath a clickable label) — this was the single
//     biggest "not modern" element per the screenshot.
//   - Section headers: font-playfair -> font-semibold text-gray-800,
//     matching ManageNotices.jsx's header treatment exactly (that's
//     the most relevant existing reference in this codebase, not an
//     invented new style).
//   - Card/input/button spacing, border colors brought in line with
//     ManageNotices.jsx's conventions. Border radius reduced TWICE now
//     — this pass takes every remaining radius down one more step
//     (containers rounded-xl -> rounded-lg, inputs/dropzone rounded-lg
//     -> rounded-md, thumbnails rounded-md -> rounded, list item cards
//     rounded-lg -> rounded-md) per feedback that it wasn't just the
//     images that needed a smaller radius — every element on the page
//     did.
//   - Add/Update/Cancel/Edit/Delete buttons: switched to shadcn's
//     size="sm" (slimmer height) plus an explicit rounded-md override,
//     since the default Button size read as bulky next to the now
//     much-smaller radii used everywhere else on the page.
//   - Preview thumbnails and gallery list images: now match the same
//     small-radius language applied to GalleryCard.jsx and
//     GalleryDetail.jsx's photo grid — unified across public AND admin
//     gallery images.
//   - shadcn Button and AlertDialog components: structurally UNCHANGED
//     (still the same components), only their size/className props
//     adjusted as noted above.
//
// UNCHANGED (functional): multi-image state (formData.images array),
// handleImages, removeSelectedImage, handleEdit's existing-image
// preview population, submit validation, delete flow — identical to
// the previous version.

import React, { useState, useEffect } from "react";
import Title from "../../components/Title";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, X, Paperclip, Images } from "lucide-react";
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
    images: [],
  });
  const [imagePreviews, setImagePreviews] = useState([]);
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

  const handleImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setFormData((prev) => ({ ...prev, images: files }));
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const removeSelectedImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData._id && formData.images.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      formData.images.forEach((file) => payload.append("images", file));

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
        setFormData({ _id: null, title: "", description: "", images: [] });
        setImagePreviews([]);
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
      images: [],
    });
    const existingUrls = item.images?.length
      ? item.images.map((img) => img.url)
      : (item.image ? [item.image] : []);
    setImagePreviews(existingUrls);
  };

  const cancelEdit = () => {
    setFormData({ _id: null, title: "", description: "", images: [] });
    setImagePreviews([]);
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

  const hasNewSelection = formData.images.length > 0;

  // ---------- UI ----------
  return (
    <div className="w-full bg-white">
      <Title title="Manage Gallery" subTitle="Add, edit or remove community gallery items." />

      {loading && (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="animate-spin h-8 w-8 border-2 border-gray-200
                          border-t-[var(--color-primary)] rounded-full" />
        </div>
      )}

      {!loading && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ----- FORM ----- */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm h-fit"
          >
            <h3 className="font-semibold text-gray-800 mb-5">
              {formData._id ? `Edit — ${formData.title}` : "Add New Item"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Title *
                </label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Event or album title"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-md outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Brief description of the event"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-md outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Images
                  {formData._id && (
                    <span className="text-gray-400 font-normal ml-1">
                      — selecting new images replaces all existing ones
                    </span>
                  )}
                </label>

                {/* Preview grid — shown above the dropzone once files
                    are chosen, or once an item is being edited.        */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={src}
                          alt={`preview ${i + 1}`}
                          className="h-20 w-full object-cover rounded
                                    border border-gray-200"
                        />
                        {hasNewSelection && (
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(i)}
                            className="absolute -top-1.5 -right-1.5 bg-white
                                       text-red-500 rounded-full w-5 h-5
                                       flex items-center justify-center
                                       shadow-sm border border-gray-200
                                       hover:bg-red-50 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Styled dropzone — replaces the native file input's
                    default browser chrome.                             */}
                <label className="flex items-center gap-3 px-4 py-3
                  border-2 border-dashed border-gray-200 rounded-md
                  cursor-pointer hover:border-[var(--color-primary)]
                  hover:bg-blue-50/30 transition-colors">
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">
                    Click to attach images
                    <span className="text-gray-400"> — multiple allowed</span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImages}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  size="sm"
                  className="rounded-md px-5 font-medium"
                >
                  {loading ? "Saving…" : formData._id ? "Update" : "Add"}
                </Button>
                {formData._id && (
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    className="rounded-md px-5 font-medium"
                    onClick={cancelEdit}
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
            className="lg:col-span-2 bg-white border border-gray-100 rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-800">Gallery List</h3>
              <p className="text-sm text-gray-400">
                {gallery.length} item{gallery.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gallery.map((item) => (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-4 border border-gray-100 rounded-md
                            hover:shadow-sm transition-shadow"
                >
                  <div className="relative mb-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-36 w-full object-cover rounded"
                    />
                    {item.images?.length > 1 && (
                      <span className="absolute top-2 right-2 flex items-center gap-1
                                       bg-black/60 backdrop-blur-sm text-white
                                       text-[11px] font-semibold px-2 py-1 rounded-full">
                        <Images className="h-3 w-3" strokeWidth={2} />
                        {item.images.length}
                      </span>
                    )}
                  </div>

                  <h4 className="font-outfit font-semibold text-gray-800 text-sm">
                    {item.title}
                  </h4>
                  <p className="text-gray-500 font-outfit text-xs mt-1 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-md"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDelete(item._id, item.title)}
                      className="rounded-md text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </motion.div>
              ))}
              {gallery.length === 0 && (
                <p className="text-gray-400 text-sm col-span-2 py-8 text-center">
                  No items yet. Add the first one on the left.
                </p>
              )}
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
              Are you sure you want to delete "{deleteTitle}"? This cannot be undone.
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