// client/src/pages/admin/ManageNotices.jsx
//
// CHANGES (this pass):
//   - ONLY the notice list section's visual layout changed, to match
//     the row format used on the public Notices.jsx list page:
//     date chip (month/day) -> vertical divider -> content -> right-side
//     element. On the public page the right-side element is an arrow;
//     here it's the Edit/Delete actions, since this is the admin view.
//   - The attachment thumbnail (image/PDF icon) and the PDF badge are
//     kept exactly as before, just repositioned into the new row shape.
//   - No functional changes: fetch, save, delete, file validation,
//     preview, edit/add form — all untouched.
//   - Everything above the list (the add/edit form) is unchanged.

import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Plus, Edit2, Trash2, Loader2,
  FileText, ImageIcon, X, Paperclip,
  Eye,
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";

const EMPTY_FORM = {
  title:   "",
  date:    "",
  summary: "",
};

export default function ManageNotices() {
  const { axios, getToken } = useAppContext();

  const [notices,      setNotices]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [editingNotice,setEditingNotice]= useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [file,         setFile]         = useState(null);         // new file selected
  const [filePreview,  setFilePreview]  = useState(null);        // preview URL for images
  const [removeAttach, setRemoveAttach] = useState(false);       // flag to remove existing

  const fileInputRef = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchNotices = async () => {
    try {
      const { data } = await axios.get("/api/notices");
      if (data.success) setNotices(data.notices);
    } catch {
      toast.error("Failed to load notices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  // ── File selection ────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(selected.type)) {
      toast.error("Only JPG, PNG, WEBP, or PDF files allowed");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setFile(selected);
    setRemoveAttach(false);

    // Generate preview only for images
    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target.result);
      reader.readAsDataURL(selected);
    } else {
      setFilePreview(null); // PDF — no image preview
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
    setRemoveAttach(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Form open/close ───────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingNotice(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setFilePreview(null);
    setRemoveAttach(false);
    setShowForm(true);
  };

  const openEdit = (notice) => {
    setEditingNotice(notice);
    setForm({
      title:   notice.title,
      date:    notice.date
        ? new Date(notice.date).toISOString().slice(0, 10)
        : "",
      summary: notice.summary || "",
    });
    setFile(null);
    setFilePreview(null);
    setRemoveAttach(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingNotice(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setFilePreview(null);
    setRemoveAttach(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) { toast.error("Title is required");   return; }
    if (!form.date)          { toast.error("Date is required");    return; }
    if (!form.summary.trim()){ toast.error("Summary is required"); return; }

    setSaving(true);
    try {
      const token   = await getToken();
      const payload = new FormData();
      payload.append("title",   form.title.trim());
      payload.append("date",    form.date);
      payload.append("summary", form.summary.trim());
      if (file)         payload.append("image", file); // multer field name stays "image"
      if (removeAttach) payload.append("removeAttachment", "true");

      const config = {
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      };

      if (editingNotice) {
        const { data } = await axios.put(
          `/api/notices/${editingNotice._id}`, payload, config
        );
        if (data.success) {
          setNotices(prev => prev.map(n => n._id === editingNotice._id ? data.notice : n));
          toast.success("Notice updated");
          closeForm();
        }
      } else {
        const { data } = await axios.post("/api/notices", payload, config);
        if (data.success) {
          setNotices(prev => [data.notice, ...prev]);
          toast.success("Notice created");
          closeForm();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save notice");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (notice) => {
    if (!window.confirm(`Delete "${notice.title}"?`)) return;
    setDeleting(notice._id);
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/notices/${notice._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setNotices(prev => prev.filter(n => n._id !== notice._id));
        toast.success("Notice deleted");
      }
    } catch {
      toast.error("Failed to delete notice");
    } finally {
      setDeleting(null);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Resolve the current attachment of a notice (new field or legacy)
  const getAttachment = (notice) => ({
    url:  notice.attachment || notice.image || "",
    type: notice.attachmentType || (notice.image ? "image" : ""),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-playfair text-2xl font-semibold text-gray-900">
            Manage Notices
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {notices.length} notice{notices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2
            bg-[var(--color-primary)] hover:bg-blue-700
            text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Notice
        </button>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-5">
            {editingNotice ? `Edit — ${editingNotice.title}` : "Add New Notice"}
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Title + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Notice title"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Date *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Summary *
              </label>
              <textarea
                value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                placeholder="Brief summary shown on the notices list"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200
                  rounded-xl outline-none focus:ring-2
                  focus:ring-[var(--color-primary)]/20
                  focus:border-[var(--color-primary)] bg-white resize-none"
              />
            </div>

            {/* Attachment */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Attachment
                <span className="text-gray-400 font-normal ml-1">
                  — image (JPG/PNG/WEBP) or PDF, max 10MB
                </span>
              </label>

              {/* Show existing attachment in edit mode */}
              {editingNotice && !file && !removeAttach && (() => {
                const { url, type } = getAttachment(editingNotice);
                if (!url) return null;
                return (
                  <div className="flex items-center gap-3 mb-3 p-3
                    bg-white border border-gray-200 rounded-xl">
                    {type === "image" ? (
                      <img src={url} alt="attachment"
                        className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-red-50 border border-red-200
                        rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        Current {type === "pdf" ? "PDF" : "image"}
                      </p>
                      <a href={url} target="_blank" rel="noreferrer"
                        className="text-[11px] text-[var(--color-primary)] hover:underline
                          flex items-center gap-1 mt-0.5">
                        <Eye className="h-3 w-3" /> View
                      </a>
                    </div>
                    <button type="button" onClick={handleRemoveFile}
                      className="p-1.5 text-gray-400 hover:text-red-500
                        hover:bg-red-50 rounded-lg transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })()}

              {/* New file preview */}
              {file && (
                <div className="flex items-center gap-3 mb-3 p-3
                  bg-white border border-gray-200 rounded-xl">
                  {filePreview ? (
                    <img src={filePreview} alt="preview"
                      className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-red-50 border border-red-200
                      rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button type="button" onClick={handleRemoveFile}
                    className="p-1.5 text-gray-400 hover:text-red-500
                      hover:bg-red-50 rounded-lg transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* File input */}
              {!file && (
                <label className="flex items-center gap-3 px-4 py-3
                  border-2 border-dashed border-gray-200 rounded-xl
                  cursor-pointer hover:border-[var(--color-primary)]
                  hover:bg-blue-50/30 transition-colors">
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">
                    Click to attach image or PDF
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5
                  bg-[var(--color-primary)] hover:bg-blue-700 text-white
                  text-sm font-semibold rounded-xl transition-colors
                  disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : editingNotice ? "Update Notice" : "Create Notice"
                }
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200
                  rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Notice list ───────────────────────────────────────────────────
          Restyled to match the Notices.jsx public list-row format:
          date chip -> divider -> content -> right-side element.
          Right-side element here is Edit/Delete (admin actions) instead
          of the public page's arrow icon — same slot, different content,
          since this view needs actions rather than a "go to" affordance.
      ─────────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No notices yet. Add the first one above.</p>
        </div>
      ) : (
        <div className="border-t border-b border-gray-100 divide-y divide-gray-100">
          {notices.map(notice => {
            const { url, type } = getAttachment(notice);
            const d     = new Date(notice.date || notice.createdAt);
            const day   = d.getDate();
            const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();

            return (
              <div
                key={notice._id}
                className="flex items-center gap-4 py-6 px-3 -mx-3
                  rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                {/* Date chip — same shape/style as the public list page */}
                <div className="flex-shrink-0 w-16 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide
                                text-emerald-600">
                    {month}
                  </p>
                  <p className="text-3xl font-semibold text-gray-800 leading-tight">
                    {day}
                  </p>
                </div>

                {/* Divider */}
                <div className="flex-shrink-0 w-px h-12 bg-gray-200" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-base font-semibold text-gray-800 truncate">
                      {notice.title}
                    </p>

                    {/* Attachment indicator — icon + label pill, replaces
                        the old cropped-image thumbnail. Covers both
                        image and PDF attachments with the same pattern. */}
                    {type === "pdf" && (
                      <span className="flex-shrink-0 flex items-center gap-1
                        text-xs font-bold px-2 py-1
                        bg-red-50 text-red-600 rounded-full border border-red-200">
                        <FileText className="h-3 w-3" />
                        PDF
                      </span>
                    )}
                    {type === "image" && url && (
                      <span className="flex-shrink-0 flex items-center gap-1
                        text-xs font-bold px-2 py-1
                        bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                        <ImageIcon className="h-3 w-3" />
                        Image
                      </span>
                    )}
                  </div>
                  {notice.summary && (
                    <p className="text-sm text-gray-500 truncate">
                      {notice.summary}
                    </p>
                  )}
                </div>

                {/* Actions — same handlers/behavior as before, just
                    moved into the row's right-side slot */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(notice)}
                    className="p-2 text-gray-400 hover:text-[var(--color-primary)]
                      hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(notice)}
                    disabled={deleting === notice._id}
                    className="p-2 text-gray-400 hover:text-red-500
                      hover:bg-red-50 rounded-lg transition-colors
                      disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === notice._id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}