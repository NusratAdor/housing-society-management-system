// pages/admin/ManageMembers.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
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
} from "lucide-react";

const ManageMembers = () => {
  const { getToken } = useAuth();
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [membershipError, setMembershipError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const membersPerPage = 10;

  const normalizePhone = (input) => {
    if (!input) return "";
    return input.replace(/[^0-9]/g, "").replace(/^880/, "").replace(/^0+/, "0");
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

  const fetchMembers = async (retryCount = 0) => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error("Failed to get authentication token");
      const { data } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/admin/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setMembers(data.members);
        setFiltered(data.members);
        if (!data.members.length) toast("No members found in the database", { icon: "Info" });
      } else {
        setError(data.message || "Failed to load members");
      }
    } catch (err) {
      const message =
        err.response?.status === 404
          ? "Members endpoint not found. Check backend configuration."
          : err.response?.data?.errors?.[0]?.code === "authorization_invalid"
          ? "Authentication failed. Please sign in again."
          : "Error loading members. Please try again later.";
      setError(message);
      if (retryCount < 2) setTimeout(() => fetchMembers(retryCount + 1), 1000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [getToken]);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    setFiltered(
      members.filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.email.toLowerCase().includes(lower)
      )
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

  const totalPages = Math.ceil(filtered.length / membersPerPage);
  const startIdx = (currentPage - 1) * membersPerPage;
  const currentMembers = filtered.slice(startIdx, startIdx + membersPerPage);

  const handleEdit = (member) => {
    setEditingMember({
      ...member,
      phone: member.phone || "",
      membershipNo: member.membershipNo || "",
      paymentStatus: member.paymentStatus || "Pending",
      role: member.role || "member",
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
    if (editingMember.phone && !/^(013|014|015|016|017|018|019)\d{8}$/.test(normalizedPhone)) {
      toast.error("Invalid phone number");
      return;
    }
    if (editingMember.membershipNo && !/^[A-Za-z0-9-]+$/.test(editingMember.membershipNo)) {
      toast.error("Invalid membership number");
      return;
    }
    try {
      const token = await getToken();
      const { data } = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/admin/members/${editingMember._id}`,
        {
          name: editingMember.name,
          phone: normalizedPhone,
          address: editingMember.address,
          designation: editingMember.designation,
          membershipNo: editingMember.membershipNo?.trim().toUpperCase(),
          plotNo: editingMember.plotNo,
          paymentStatus: editingMember.paymentStatus,
          role: editingMember.role,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setMembers((prev) =>
          prev.map((m) => (m._id === editingMember._id ? data.member : m))
        );
        setFiltered((prev) =>
          prev.map((m) => (m._id === editingMember._id ? data.member : m))
        );
        setEditingMember(null);
        toast.success("Member updated successfully");
      } else {
        toast.error(data.message || "Failed to update member");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update member");
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getToken();
      const { data } = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/admin/members/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setMembers((prev) => prev.filter((m) => m._id !== id));
        setFiltered((prev) => prev.filter((m) => m._id !== id));
        setConfirmDelete(null);
        toast.success("Member deleted successfully");
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
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/admin/members/${id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setMembers((prev) =>
          prev.map((m) =>
            m._id === id ? { ...m, role: "admin", pendingAdmin: false } : m
          )
        );
        setFiltered((prev) =>
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

  if (loading)
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );
  if (error)
    return (
      <div className="text-center text-red-500 mt-10 font-medium">{error}</div>
    );

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Manage Members</h1>
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
            className="sm:absolute sm:top-0 sm:right-0 md:static flex items-center gap-2 w-auto"
          >
            {sortOrder === "asc" ? (
              <>
                <SortAsc className="h-4 w-4" /> Sort A–Z
              </>
            ) : (
              <>
                <SortDesc className="h-4 w-4" /> Sort Z–A
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm text-left text-gray-600">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 font-medium text-gray-700">Name</th>
              <th className="p-3 font-medium text-gray-700">Email</th>
              <th className="p-3 font-medium text-gray-700">Phone</th>
              <th className="p-3 font-medium text-gray-700">Membership No</th>
              <th className="p-3 font-medium text-gray-700">Due Amount</th>
              <th className="p-3 font-medium text-gray-700">Payment Status</th>
              <th className="p-3 font-medium text-gray-700">Role</th>
              <th className="p-3 font-medium text-gray-700">Admin Request</th>
              <th className="p-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentMembers.length > 0 ? (
              currentMembers.map((member, index) => (
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
                  <td className="p-3">
                    <Badge variant={member.dueAmount > 0 ? "destructive" : "secondary"}>
                      {member.dueAmount || 0} TK
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        member.paymentStatus === "Paid"
                          ? "success"
                          : member.paymentStatus === "Due"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {member.paymentStatus}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={member.role === "admin" ? "destructive" : "outline"}>
                      {member.role}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {member.pendingAdmin ? (
                      <Button
                        variant="link"
                        className="text-green-500 p-0 h-auto"
                        onClick={() => handleApproveAdmin(member._id)}
                      >
                        Approve
                      </Button>
                    ) : (
                      "None"
                    )}
                  </td>
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
              ))
            ) : (
              <tr>
                <td colSpan="9" className="p-3 text-center text-gray-500">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

      {/* Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md mt-4 mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Edit Member</h2>
            <form onSubmit={handleSave} className="space-y-4">
              {[
                { label: "Name", key: "name", type: "text" },
                {
                  label: "Phone",
                  key: "phone",
                  type: "tel",
                  error: phoneError,
                  onChange: (e) => {
                    setEditingMember({ ...editingMember, phone: e.target.value });
                    validatePhone(e.target.value);
                  },
                },
                { label: "Address", key: "address", type: "text" },
                { label: "Designation", key: "designation", type: "text" },
                {
                  label: "Membership No",
                  key: "membershipNo",
                  type: "text",
                  error: membershipError,
                  onChange: (e) => {
                    setEditingMember({ ...editingMember, membershipNo: e.target.value });
                    validateMembership(e.target.value);
                  },
                },
                { label: "Plot No", key: "plotNo", type: "text" },
                {
                  label: "Payment Status",
                  key: "paymentStatus",
                  type: "select",
                  options: ["Pending", "Paid", "Due"],
                },
                {
                  label: "Role",
                  key: "role",
                  type: "select",
                  options: ["member", "admin"],
                },
              ].map((field) => (
                <div key={field.key} className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1 font-medium">{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      value={editingMember[field.key]}
                      onChange={(e) => setEditingMember({ ...editingMember, [field.key]: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                      onChange={field.onChange || ((e) => setEditingMember({ ...editingMember, [field.key]: e.target.value }))}
                      className={field.error ? "border-red-500" : ""}
                    />
                  )}
                  {field.error && <p className="text-red-500 text-sm mt-1">{field.error}</p>}
                </div>
              ))}
              <div className="flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={phoneError || membershipError}
                  className={`bg-blue-500 hover:bg-blue-600 text-white ${phoneError || membershipError ? "opacity-50 cursor-not-allowed" : ""}`}
                >
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

      {/* Confirm Delete Modal */}
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
              <span className="font-semibold">{confirmDelete.name}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
              >
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