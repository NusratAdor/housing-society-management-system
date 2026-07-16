// pages/admin/ManageEvents.jsx
//
// Mirrors ManageAnnouncement.jsx's form+list structure and
// ManageCommittee.jsx's image upload pattern (styled dropzone,
// preview, replace-on-edit). Date field uses the same <input
// type="date"> convention as ManageAnnouncement's start/end dates.
//
// isPublished mirrors Announcement's isActive — a visibility toggle,
// not a delete. Upcoming/Past badge on each list item is computed the
// same way as everywhere else in the Events system: eventDate vs now,
// never a stored field.

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Paperclip, CalendarClock, MapPin } from "lucide-react";
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

import Title from "../../components/Title";
import { useAppContext } from "../../context/AppContext";
import usePageTitle from "../../hooks/usePageTitle";

const EMPTY_FORM = {
  _id: null,
  title: "",
  excerpt: "",
  description: "",
  location: "",
  eventDate: "",
  isPublished: true,
};

const toDateInputValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const ManageEvents = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Events");

  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteTitle, setDeleteTitle] = useState("");

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setEvents(data.events);
    } catch (error) {
      console.error("fetchEvents error:", error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setImageFile(null);
    setImagePreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || !formData.eventDate) {
      toast.error("Title, description and event date are required");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const payload = new FormData();
      payload.append("title", formData.title.trim());
      payload.append("excerpt", formData.excerpt.trim());
      payload.append("description", formData.description.trim());
      payload.append("location", formData.location.trim());
      payload.append("eventDate", formData.eventDate);
      payload.append("isPublished", formData.isPublished);
      if (imageFile) payload.append("image", imageFile);

      let res;
      if (formData._id) {
        res = await axios.put(`/api/events/${formData._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await axios.post("/api/events", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (res.data.success) {
        toast.success(formData._id ? "Event updated" : "Event created");
        fetchEvents();
        resetForm();
      }
    } catch {
      toast.error("Error saving event");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      _id: item._id,
      title: item.title,
      excerpt: item.excerpt || "",
      description: item.description,
      location: item.location || "",
      eventDate: toDateInputValue(item.eventDate),
      isPublished: item.isPublished,
    });
    setImageFile(null);
    setImagePreview(item.image || "");
  };

  const openDelete = (id, title) => {
    setDeleteId(id);
    setDeleteTitle(title);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/events/${deleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e._id !== deleteId));
        toast.success("Event deleted");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
      setDeleteTitle("");
    }
  };

  const now = new Date();

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage Events"
        subTitle="Create, edit and publish community events. Upcoming vs past is calculated automatically from the event date."
      />

      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm h-fit"
          >
            <h3 className="font-semibold text-gray-800 mb-5">
              {formData._id ? `Edit — ${formData.title}` : "New Event"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Title *</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Annual General Meeting"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Excerpt <span className="text-gray-400 font-normal">— short summary for cards</span>
                </label>
                <input
                  name="excerpt"
                  value={formData.excerpt}
                  onChange={handleChange}
                  placeholder="One line shown on the events list"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Full details shown on the event's own page"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Event date *</label>
                  <input
                    type="date"
                    name="eventDate"
                    value={formData.eventDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                              outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                              focus:border-[var(--color-primary)] bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Location</label>
                  <input
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Community Hall"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                              outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                              focus:border-[var(--color-primary)] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Photo</label>

                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="h-32 w-full object-cover rounded-md border border-gray-200 mb-3"
                  />
                )}

                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed
                                  border-gray-200 rounded-md cursor-pointer
                                  hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-colors">
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">Click to attach a photo</span>
                  <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPublished"
                  checked={formData.isPublished}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]
                            focus:ring-[var(--color-primary)]/30"
                />
                Published <span className="text-gray-400 font-normal text-xs">— visible on the site</span>
              </label>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={loading} size="sm" className="rounded-md px-5 font-medium">
                  {loading ? "Saving…" : formData._id ? "Update" : "Create"}
                </Button>
                {formData._id && (
                  <Button variant="outline" type="button" size="sm" className="rounded-md px-5 font-medium" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </motion.div>

          {/* List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 bg-white border border-gray-100 rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-800">All Events</h3>
              <p className="text-sm text-gray-400">{events.length} total</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map((item) => {
                const isPast = new Date(item.eventDate) < now;
                return (
                  <motion.div
                    key={item._id}
                    layout
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="p-4 border border-gray-100 rounded-md hover:shadow-sm transition-shadow"
                  >
                    {item.image && (
                      <img src={item.image} alt={item.title} className="h-28 w-full object-cover rounded mb-3" />
                    )}

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        !item.isPublished
                          ? "bg-gray-100 text-gray-500"
                          : isPast
                          ? "bg-gray-100 text-gray-400"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {!item.isPublished ? "Unpublished" : isPast ? "Past" : "Upcoming"}
                      </span>
                    </div>

                    <h4 className="font-outfit font-semibold text-gray-800 text-sm">{item.title}</h4>
                    <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                      <CalendarClock size={11} strokeWidth={2} />
                      {new Date(item.eventDate).toLocaleDateString("en-GB")}
                    </p>
                    {item.location && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                        <MapPin size={11} strokeWidth={2} />
                        {item.location}
                      </p>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="rounded-md" onClick={() => handleEdit(item)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-md text-red-500 hover:text-red-600"
                        onClick={() => openDelete(item._id, item.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
              {events.length === 0 && (
                <p className="text-gray-400 text-sm col-span-2 py-8 text-center">
                  No events yet. Add the first one on the left.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
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

export default ManageEvents;