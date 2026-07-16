// pages/admin/ManageCommittee.jsx
//
// Modeled closely on ManageGallery.jsx's established conventions
// (styled dropzone, small radius, card list layout) — one form manages
// all 6 categories via a select dropdown, since they share one backend
// model.

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Paperclip, Users } from "lucide-react";
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

const CATEGORY_OPTIONS = [
  { value: "chairman",                label: "Chairman" },
  { value: "generalSecretary",        label: "General Secretary" },
  { value: "adviser",                 label: "Adviser" },
  { value: "formerChairman",          label: "Former Chairman" },
  { value: "formerGeneralSecretary",  label: "Former General Secretary" },
  { value: "executiveCommittee",      label: "Executive Committee" },
];

const SINGLE_CATEGORIES = ["chairman", "generalSecretary"];

const EMPTY_FORM = {
  _id: null,
  name: "",
  designation: "",
  category: "chairman",
  message: "",
  bio: "",
  order: 0,
  tenureFrom: "",
  tenureTo: "",
};

const ManageCommittee = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Committee");

  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState("");

  const isSingle = SINGLE_CATEGORIES.includes(formData.category);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get("/api/committee", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setMembers(data.members);
    } catch {
      toast.error("Failed to load committee members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData._id && !photoFile) {
      // Photo not strictly required by backend, but recommended —
      // only warn, don't block, since some categories may add a
      // member before a photo is ready.
    }

    setLoading(true);
    try {
      const token = await getToken();
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "_id") payload.append(key, value);
      });
      if (photoFile) payload.append("photo", photoFile);

      let res;
      if (formData._id) {
        res = await axios.put(`/api/committee/${formData._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await axios.post("/api/committee", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (res.data.success) {
        toast.success(formData._id ? "Member updated" : "Member added");
        fetchMembers();
        resetForm();
      }
    } catch {
      toast.error("Error saving member");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member) => {
    setFormData({
      _id: member._id,
      name: member.name,
      designation: member.designation || "",
      category: member.category,
      message: member.message || "",
      bio: member.bio || "",
      order: member.order || 0,
      tenureFrom: member.tenureFrom || "",
      tenureTo: member.tenureTo || "",
    });
    setPhotoFile(null);
    setPhotoPreview(member.photo || "");
  };

  const openDelete = (id, name) => {
    setDeleteId(id);
    setDeleteName(name);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/committee/${deleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setMembers((prev) => prev.filter((m) => m._id !== deleteId));
        toast.success("Member deleted");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
      setDeleteName("");
    }
  };

  return (
    <div className="w-full bg-white">
      <div className="mb-6">
        <h1 className="font-playfair text-2xl font-semibold text-gray-900">Manage Committee</h1>
        <p className="text-sm text-gray-400 mt-1">
          Add, edit or remove About Us / committee members.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Form */}
          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm h-fit">
            <h3 className="font-semibold text-gray-800 mb-5">
              {formData._id ? `Edit — ${formData.name}` : "Add New Member"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Name *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Full name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Designation</label>
                <input
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g. Legal Adviser"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              {isSingle ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Message (shown as a signed letter on the page)
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Full message text..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                              outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                              focus:border-[var(--color-primary)] bg-white resize-none"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Bio</label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Short bio shown on their detail page"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                                outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                                focus:border-[var(--color-primary)] bg-white resize-none"
                    />
                  </div>

                  {formData.category.startsWith("former") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Tenure from</label>
                        <input
                          name="tenureFrom"
                          value={formData.tenureFrom}
                          onChange={handleChange}
                          placeholder="2018"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                                    outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                                    focus:border-[var(--color-primary)] bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Tenure to</label>
                        <input
                          name="tenureTo"
                          value={formData.tenureTo}
                          onChange={handleChange}
                          placeholder="2022"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                                    outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                                    focus:border-[var(--color-primary)] bg-white"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Display order</label>
                <input
                  type="number"
                  name="order"
                  value={formData.order}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md
                            outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                            focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Photo</label>

                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="preview"
                    className="h-24 w-24 object-cover rounded-full border border-gray-200 mb-3"
                  />
                )}

                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed
                                  border-gray-200 rounded-md cursor-pointer
                                  hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-colors">
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500">Click to attach photo</span>
                  <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={loading} size="sm" className="rounded-md px-5 font-medium">
                  {loading ? "Saving…" : formData._id ? "Update" : "Add"}
                </Button>
                {formData._id && (
                  <Button variant="outline" type="button" size="sm" className="rounded-md px-5 font-medium" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-800">All Members</h3>
              <p className="text-sm text-gray-400">{members.length} total</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((member) => (
                <motion.div
                  key={member._id}
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-4 border border-gray-100 rounded-md hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                      {member.photo ? (
                        <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-outfit font-semibold text-gray-800 text-sm truncate">{member.name}</h4>
                      <p className="text-gray-400 text-xs truncate">
                        {CATEGORY_OPTIONS.find((c) => c.value === member.category)?.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="rounded-md" onClick={() => handleEdit(member)}>
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-md text-red-500 hover:text-red-600"
                      onClick={() => openDelete(member._id, member.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </motion.div>
              ))}
              {members.length === 0 && (
                <p className="text-gray-400 text-sm col-span-2 py-8 text-center">
                  No members yet. Add the first one on the left.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Committee Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteName}"? This cannot be undone.
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

export default ManageCommittee;