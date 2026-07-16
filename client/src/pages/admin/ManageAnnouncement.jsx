// pages/admin/ManageAnnouncement.jsx
//
// Modeled on ManageGallery.jsx / ManageCommittee.jsx's established
// conventions (form left, list right, styled inputs, AlertDialog for
// delete, edit populates the form). No file upload here — this is
// text + a few structured fields, not media.
//
// The "status" badge on each list item (Live / Scheduled / Expired /
// Inactive) is computed client-side using the exact same rule the
// backend's getActiveAnnouncement uses to decide the homepage winner
// (isActive + startDate/endDate window) — purely for admin clarity,
// not authoritative; the backend is still the source of truth for
// what actually shows on the site.

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Megaphone, AlertTriangle, AlertOctagon } from "lucide-react";
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

const TYPE_OPTIONS = [
  { value: "info",    label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "urgent",  label: "Urgent" },
];

const TYPE_META = {
  info:    { label: "Info",    icon: Megaphone,      className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  warning: { label: "Warning", icon: AlertTriangle,  className: "bg-amber-50 text-amber-700 border-amber-200" },
  urgent:  { label: "Urgent",  icon: AlertOctagon,   className: "bg-teal-100 text-teal-800 border-teal-300" },
};

const EMPTY_FORM = {
  _id: null,
  text: "",
  link: "",
  type: "info",
  isActive: true,
  startDate: "",
  endDate: "",
  priority: 0,
};

// Resolves status for the WHOLE set at once, mirroring exactly what
// announcementController.js's getActiveAnnouncement does server-side —
// filter to eligible items (Active + within date window), then the
// single highest-priority/most-recent one is the actual winner.
// Computing this per-item in isolation was wrong: it let two Active,
// in-window items both show "Live" even though only one of them is
// ever actually shown on the site. Only the true winner gets "Live"
// now; other eligible-but-losing items get "Standby" instead.
const resolveStatuses = (list) => {
  const now = new Date();

  const isEligible = (item) =>
    item.isActive &&
    (!item.startDate || new Date(item.startDate) <= now) &&
    (!item.endDate || new Date(item.endDate) >= now);

  const winner = list
    .filter(isEligible)
    .sort((a, b) =>
      b.priority !== a.priority
        ? b.priority - a.priority
        : new Date(b.createdAt) - new Date(a.createdAt)
    )[0];

  const map = {};
  list.forEach((item) => {
    if (!item.isActive) {
      map[item._id] = { label: "Inactive", className: "bg-gray-100 text-gray-500" };
    } else if (item.startDate && new Date(item.startDate) > now) {
      map[item._id] = { label: "Scheduled", className: "bg-blue-50 text-blue-600" };
    } else if (item.endDate && new Date(item.endDate) < now) {
      map[item._id] = { label: "Expired", className: "bg-gray-100 text-gray-400" };
    } else if (winner && item._id === winner._id) {
      map[item._id] = { label: "Live", className: "bg-emerald-100 text-emerald-700" };
    } else {
      map[item._id] = { label: "Standby", className: "bg-amber-50 text-amber-600" };
    }
  });
  return map;
};

const toDateInputValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const ManageAnnouncement = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Announcements");

  const [announcements, setAnnouncements] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get("/api/announcements", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setAnnouncements(data.announcements);
    } catch {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const resetForm = () => setFormData(EMPTY_FORM);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.text.trim()) {
      toast.error("Announcement text is required");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const payload = {
        text: formData.text.trim(),
        link: formData.link.trim(),
        type: formData.type,
        isActive: formData.isActive,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        priority: Number(formData.priority) || 0,
      };

      let res;
      if (formData._id) {
        res = await axios.put(`/api/announcements/${formData._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await axios.post("/api/announcements", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (res.data.success) {
        toast.success(formData._id ? "Announcement updated" : "Announcement created");
        fetchAnnouncements();
        resetForm();
      }
    } catch {
      toast.error("Error saving announcement");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      _id: item._id,
      text: item.text,
      link: item.link || "",
      type: item.type || "info",
      isActive: item.isActive,
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
      priority: item.priority || 0,
    });
  };

  const openDelete = (id) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/announcements/${deleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setAnnouncements((prev) => prev.filter((a) => a._id !== deleteId));
        toast.success("Announcement deleted");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage Announcements"
        subTitle="Create and schedule the homepage banner. Only one shows at a time — highest priority, most recent wins."
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
              {formData._id ? "Edit Announcement" : "New Announcement"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Text *</label>
                <textarea
                  name="text"
                  value={formData.text}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. Annual General Meeting on July 20th, 2026."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Link <span className="text-gray-400 font-normal">— optional</span>
                </label>
                <input
                  name="link"
                  value={formData.link}
                  onChange={handleChange}
                  placeholder="/notices/xyz or https://…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Start date <span className="text-gray-400 font-normal">— optional</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                              outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                              focus:border-[var(--color-primary)] bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    End date <span className="text-gray-400 font-normal">— optional</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                              outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                              focus:border-[var(--color-primary)] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Priority <span className="text-gray-400 font-normal">— tie-breaker, higher wins</span>
                </label>
                <input
                  type="number"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]
                            focus:ring-[var(--color-primary)]/30"
                />
                Active <span className="text-gray-400 font-normal text-xs">— site-wide on/off</span>
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
              <h3 className="font-semibold text-gray-800">All Announcements</h3>
              <p className="text-sm text-gray-400">{announcements.length} total</p>
            </div>

            <div className="space-y-3">
              {(() => {
                const statusMap = resolveStatuses(announcements);
                return announcements.map((item) => {
                const meta = TYPE_META[item.type] || TYPE_META.info;
                const Icon = meta.icon;
                const status = statusMap[item._id];
                return (
                  <motion.div
                    key={item._id}
                    layout
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="p-4 border border-gray-100 rounded-md hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-outfit text-sm text-gray-800 flex-1">{item.text}</p>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.className}`}>
                        <Icon className="h-3 w-3" strokeWidth={2} />
                        {meta.label}
                      </span>
                      {item.priority > 0 && (
                        <span className="text-[11px] text-gray-400">Priority {item.priority}</span>
                      )}
                      {(item.startDate || item.endDate) && (
                        <span className="text-[11px] text-gray-400">
                          {item.startDate ? toDateInputValue(item.startDate) : "…"}
                          {" → "}
                          {item.endDate ? toDateInputValue(item.endDate) : "…"}
                        </span>
                      )}
                      {item.link && (
                        <span className="text-[11px] text-gray-400 truncate max-w-[160px]">→ {item.link}</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-md" onClick={() => handleEdit(item)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-md text-red-500 hover:text-red-600"
                        onClick={() => openDelete(item._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </motion.div>
                );
                });
              })()}
              {announcements.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">
                  No announcements yet. Create the first one on the left.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If this announcement is currently live on the homepage, it will disappear immediately.
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

export default ManageAnnouncement;