// pages/admin/ManageMembers.jsx
//
// CHANGES from previous version:
//   1. Switched from /dashboard/outstanding to the new
//      /dashboard/member-due-status endpoint — every member now gets a
//      definitive Paid/Due badge, not just members who owe something.
//   2. Due badge is now clickable — shows a small popover breaking the
//      total into Monthly vs Extra, sourced from the same computed data,
//      no extra request needed. Progressive disclosure instead of two
//      permanent columns that would be empty for most rows.
//   3. "Admin Request" column removed. A pending request now shows as a
//      small actionable badge folded into the Role column — visible only
//      for the rare member who actually requested it.
//   4. Reject admin request popover added — optional reason, low-friction.
//   5. ADDED: total member count badge next to the page heading — shows
//      "X of Y" while actively searching, plain total otherwise. Same
//      Badge component and pattern already used in CustomCharges.jsx,
//      for visual consistency across the admin panel.

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  SortAsc,
  SortDesc,
  Info,
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";

import usePageTitle from "../../hooks/usePageTitle";

const ManageMembers = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Members");

  const [members,        setMembers]        = useState([]);
  const [dueByMemberId,  setDueByMemberId]  = useState({});
  const [filtered,       setFiltered]       = useState([]);
  const [searchTerm,     setSearchTerm]     = useState("");
  const [sortOrder,      setSortOrder]      = useState("asc");
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const [editingMember,  setEditingMember]  = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [phoneError,     setPhoneError]     = useState("");
  const [membershipError,setMembershipError]= useState("");
  const [currentPage,    setCurrentPage]    = useState(1);
  const [openDuePopover, setOpenDuePopover] = useState(null); // memberId | null
  const [rejectPopover,  setRejectPopover]  = useState(null); // memberId | null
  const [rejectReason,   setRejectReason]   = useState("");
  const [rejecting,      setRejecting]      = useState(false);

  const membersPerPage = 10;

  // ── Validation helpers ──────────────────────────────────────────────────

  const normalizePhone = (input) => {
    if (!input) return "";
    return input
      .replace(/[^0-9]/g, "")
      .replace(/^880/, "")
      .replace(/^0+/, "0");
  };

  const validatePhone = (input) => {
    const normalized = normalizePhone(input);
    if (!normalized || normalized === "0") {
      setPhoneError("");
      return true;
    }
    if (!/^(013|014|015|016|017|018|019)\d{8}$/.test(normalized)) {
      setPhoneError("Invalid Bangladeshi phone number");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validateMembership = (value) => {
    if (!value) {
      setMembershipError("");
      return true;
    }
    if (!/^[A-Za-z0-9-]+$/.test(value)) {
      setMembershipError("Invalid membership number");
      return false;
    }
    setMembershipError("");
    return true;
  };

  // ── Fetch members + due status ──────────────────────────────────────────

  const fetchMembers = useCallback(
    async (retryCount = 0) => {
      try {
        setLoading(true);
        setError("");
        const token = await getToken();
        if (!token) throw new Error("Failed to get authentication token");

        const [membersRes, dueRes] = await Promise.all([
          axios.get("/api/admin/members", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios
            .get("/api/admin/dashboard/member-due-status", {
              headers: { Authorization: `Bearer ${token}` },
            })
            .catch(() => null),
        ]);

        if (membersRes.data.success) {
          setMembers(membersRes.data.members);
          setFiltered(membersRes.data.members);
          if (!membersRes.data.members.length) {
            toast("No members found in the database", { icon: "ℹ️" });
          }
        } else {
          setError(membersRes.data.message || "Failed to load members");
        }

        if (dueRes?.data?.success) {
          const map = {};
          for (const row of dueRes.data.members) {
            map[row.memberId] = {
              totalDue:      row.totalDue,
              monthlyDue:    row.monthlyDue,
              extraDue:      row.extraDue,
              paymentStatus: row.paymentStatus,
            };
          }
          setDueByMemberId(map);
        }
      } catch (err) {
        const message =
          err.response?.status === 404
            ? "Members endpoint not found. Check backend configuration."
            : err.response?.data?.errors?.[0]?.code === "authorization_invalid"
            ? "Authentication failed. Please sign in again."
            : "Error loading members. Please try again later.";
        setError(message);
        if (retryCount < 2)
          setTimeout(() => fetchMembers(retryCount + 1), 1000);
      } finally {
        setLoading(false);
      }
    },
    [axios, getToken],
  );

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ── Search filter ────────────────────────────────────────────────────────

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    setFiltered(
      members.filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.email.toLowerCase().includes(lower),
      ),
    );
    setCurrentPage(1);
  }, [searchTerm, members]);

  const toggleSort = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
    const sorted = [...filtered].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return newOrder === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
    setFiltered(sorted);
  };

  const totalPages    = Math.ceil(filtered.length / membersPerPage);
  const startIdx      = (currentPage - 1) * membersPerPage;
  const currentMembers = filtered.slice(startIdx, startIdx + membersPerPage);

  // Close any open popover when changing page or search
  useEffect(() => {
    setOpenDuePopover(null);
    setRejectPopover(null);
  }, [currentPage, searchTerm]);

  // ── Edit handling ────────────────────────────────────────────────────────

  const handleEdit = (member) => {
    setEditingMember({
      ...member,
      phone:        member.phone        || "",
      membershipNo: member.membershipNo || "",
      role:         member.role         || "member",
    });
    setPhoneError("");
    setMembershipError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (phoneError || membershipError) {
      toast.error("Please fix form errors before saving");
      return;
    }

    const normalizedPhone = normalizePhone(editingMember.phone);
    if (
      editingMember.phone &&
      !/^(013|014|015|016|017|018|019)\d{8}$/.test(normalizedPhone)
    ) {
      toast.error("Invalid phone number");
      return;
    }
    if (
      editingMember.membershipNo &&
      !/^[A-Za-z0-9-]+$/.test(editingMember.membershipNo)
    ) {
      toast.error("Invalid membership number");
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      const { data } = await axios.put(
        `/api/admin/members/${editingMember._id}`,
        {
          name:         editingMember.name,
          phone:        normalizedPhone,
          address:      editingMember.address,
          designation:  editingMember.designation,
          membershipNo: editingMember.membershipNo?.trim().toUpperCase(),
          plotNo:       editingMember.plotNo,
          role:         editingMember.role,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (data.success) {
        setMembers((prev) =>
          prev.map((m) => (m._id === editingMember._id ? data.member : m)),
        );
        setEditingMember(null);
        toast.success("Member updated successfully");
      } else {
        toast.error(data.message || "Failed to update member");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update member");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/admin/members/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setMembers((prev) => prev.filter((m) => m._id !== id));
        setConfirmDelete(null);
        toast.success("Member and related records deleted");
      } else {
        toast.error(data.message || "Failed to delete member");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete member");
    }
  };

const handleApproveAdmin = async (id) => {
  try {
    const token = await getToken();
    const { data } = await axios.put(
      `/api/admin/members/${id}/approve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (data.success) {
      setMembers((prev) =>
        prev.map((m) =>
          m._id === id ? { ...m, role: "admin", pendingAdmin: false } : m
        )
      );
      toast.success("Member approved as admin");
    } else {
      toast.error(data.message || "Failed to approve admin");
    }
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to approve admin");
  }
};

// Replace handleRejectAdmin with this version — adds a guard against
// double-submission and treats "already resolved" as a soft, non-alarming
// outcome rather than a scary error, since the end state the admin wanted
// (no pending request) is already true.

const handleRejectAdmin = async (id) => {
  // Guard: if a reject request for this exact member is already in flight,
  // ignore subsequent clicks instead of firing a duplicate request.
  if (rejecting) return;

  setRejecting(true);
  try {
    const token = await getToken();
    const { data } = await axios.put(
      `/api/admin/members/${id}/reject-admin-request`,
      { reason: rejectReason.trim() },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (data.success) {
      setMembers((prev) =>
        prev.map((m) => (m._id === id ? { ...m, pendingAdmin: false } : m))
      );
      toast.success("Admin request rejected");
      setRejectPopover(null);
      setRejectReason("");
    } else {
      // The request was already resolved (approved/rejected elsewhere,
      // or local state was stale). Sync local state to match reality
      // instead of leaving a phantom "pendingAdmin: true" badge showing.
      setMembers((prev) =>
        prev.map((m) => (m._id === id ? { ...m, pendingAdmin: false } : m))
      );
      toast(data.message || "This request was already resolved", { icon: "ℹ️" });
      setRejectPopover(null);
      setRejectReason("");
    }
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to reject request");
  } finally {
    setRejecting(false);
  }
};

  // ── Loading / error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 mt-10 font-medium">{error}</div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-gray-800">Manage Members</h1>
          <Badge variant="secondary" className="font-medium">
            {searchTerm.trim()
              ? `${filtered.length} of ${members.length}`
              : `${members.length} total`}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              className="pl-9 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            onClick={toggleSort}
            variant="outline"
            className="flex items-center gap-2 w-auto"
          >
            {sortOrder === "asc" ? (
              <><SortAsc className="h-4 w-4" /> Sort A–Z</>
            ) : (
              <><SortDesc className="h-4 w-4" /> Sort Z–A</>
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm text-left text-gray-600">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 font-medium text-gray-700">Name</th>
              <th className="p-3 font-medium text-gray-700">Email</th>
              <th className="p-3 font-medium text-gray-700">Phone</th>
              <th className="p-3 font-medium text-gray-700">Membership No</th>
              <th className="p-3 font-medium text-gray-700">Due Amount</th>
              <th className="p-3 font-medium text-gray-700">Payment Status</th>
              <th className="p-3 font-medium text-gray-700">Role</th>
              <th className="p-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentMembers.length > 0 ? (
              currentMembers.map((member, index) => {
                const due          = dueByMemberId[member._id];
                const hasDueData   = !!due;
                const isPopoverOpen = openDuePopover === member._id;

                return (
                  <motion.tr
                    key={member._id}
                    className="border-b hover:bg-gray-50"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <td className="p-3">{member.name}</td>
                    <td className="p-3">{member.email}</td>
                    <td className="p-3">{member.phone || "N/A"}</td>
                    <td className="p-3">{member.membershipNo || "N/A"}</td>

                    {/* ── Due Amount — clickable badge with breakdown popover ── */}
                    <td className="p-3 relative">
                      {hasDueData ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDuePopover(isPopoverOpen ? null : member._id)
                          }
                          className="inline-flex items-center gap-1 group"
                        >
                          <Badge
                            variant={due.totalDue > 0 ? "destructive" : "secondary"}
                          >
                            ৳{due.totalDue.toLocaleString()}
                          </Badge>
                          {due.totalDue > 0 && (
                            <Info className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}

                      {/* Breakdown popover */}
                      <AnimatePresence>
                        {isPopoverOpen && due.totalDue > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute z-20 top-full left-3 mt-1 w-48
                              bg-white border border-gray-200 rounded-lg shadow-lg p-3"
                          >
                            <p className="text-[10px] font-semibold text-gray-400
                              uppercase tracking-wide mb-2">
                              Due Breakdown
                            </p>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Monthly Dues</span>
                                <span className="font-semibold text-gray-800">
                                  ৳{due.monthlyDue.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Extra Charges</span>
                                <span className="font-semibold text-gray-800">
                                  ৳{due.extraDue.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between pt-1.5 border-t border-gray-100">
                                <span className="text-gray-700 font-medium">Total</span>
                                <span className="font-bold text-red-600">
                                  ৳{due.totalDue.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>

                    {/* ── Payment Status ── */}
                    <td className="p-3">
                      {hasDueData ? (
                        <Badge
                          variant={
                            due.paymentStatus === "Paid" ? "success" : "destructive"
                          }
                        >
                          {due.paymentStatus}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* ── Role — Approve + Reject popover for pending requests ── */}
                    <td className="p-3 relative">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            member.role === "admin" ? "destructive" : "outline"
                          }
                        >
                          {member.role}
                        </Badge>
                        {member.pendingAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApproveAdmin(member._id)}
                              title="Approve admin access for this member"
                              className="text-[10px] font-semibold px-1.5 py-0.5
                                rounded-full bg-emerald-100 text-emerald-700
                                hover:bg-emerald-200 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRejectPopover(
                                  rejectPopover === member._id ? null : member._id
                                )
                              }
                              title="Reject this admin access request"
                              className="text-[10px] font-semibold px-1.5 py-0.5
                                rounded-full bg-red-100 text-red-700
                                hover:bg-red-200 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── Reject confirmation popover ── */}
                      <AnimatePresence>
                        {rejectPopover === member._id && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute z-20 top-full left-3 mt-1 w-64
                              bg-white border border-gray-200 rounded-lg shadow-lg p-3"
                          >
                            <p className="text-xs font-semibold text-gray-700 mb-2">
                              Reject admin request from {member.name}?
                            </p>
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason (optional) — e.g. 'Not required for your role'"
                              rows={2}
                              className="w-full p-2 border border-gray-300 rounded-md
                                text-xs focus:outline-none focus:ring-2
                                focus:ring-red-300 resize-none mb-2"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectPopover(null);
                                  setRejectReason("");
                                }}
                                disabled={rejecting}
                                className="text-xs px-2.5 py-1 rounded-md
                                  text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectAdmin(member._id)}
                                disabled={rejecting}
                                className="text-xs px-2.5 py-1 rounded-md
                                  bg-red-600 text-white hover:bg-red-700
                                  disabled:opacity-50 transition-colors
                                  flex items-center gap-1"
                              >
                                {rejecting && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                Confirm Reject
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>

                    {/* ── Actions ── */}
                    <td className="p-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(member)}
                      >
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDelete(member)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </td>
                  </motion.tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="p-3 text-center text-gray-500">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-gray-600 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="flex items-center gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md mt-4 mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              Edit Member
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Payment status is calculated automatically from dues and payments
              — it cannot be edited here.
            </p>
            <form onSubmit={handleSave} className="space-y-4">
              {[
                { label: "Name",         key: "name",         type: "text" },
                {
                  label: "Phone",
                  key:   "phone",
                  type:  "tel",
                  error: phoneError,
                  onChange: (e) => {
                    setEditingMember({ ...editingMember, phone: e.target.value });
                    validatePhone(e.target.value);
                  },
                },
                { label: "Address",     key: "address",     type: "text" },
                { label: "Designation", key: "designation", type: "text" },
                {
                  label: "Membership No",
                  key:   "membershipNo",
                  type:  "text",
                  error: membershipError,
                  onChange: (e) => {
                    setEditingMember({ ...editingMember, membershipNo: e.target.value });
                    validateMembership(e.target.value);
                  },
                },
                { label: "Plot No", key: "plotNo", type: "text" },
                {
                  label:   "Role",
                  key:     "role",
                  type:    "select",
                  options: ["member", "admin"],
                },
              ].map((field) => (
                <div key={field.key} className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1 font-medium">
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={editingMember[field.key]}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          [field.key]: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-gray-300 rounded-md
                        focus:ring-2 focus:ring-blue-500"
                    >
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type}
                      value={editingMember[field.key] || ""}
                      onChange={
                        field.onChange ||
                        ((e) =>
                          setEditingMember({
                            ...editingMember,
                            [field.key]: e.target.value,
                          }))
                      }
                      className={field.error ? "border-red-500" : ""}
                    />
                  )}
                  {field.error && (
                    <p className="text-red-500 text-sm mt-1">{field.error}</p>
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={saving || !!phoneError || !!membershipError}
                  className={`bg-blue-500 hover:bg-blue-600 text-white gap-2 ${
                    saving || phoneError || membershipError
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Confirm Delete Modal ─────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm mt-4 mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Confirm Deletion
            </h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{confirmDelete.name}</span>? This
              will permanently remove their payment history, charges, and
              notifications as well.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(confirmDelete._id)}
              >
                Delete
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ManageMembers;