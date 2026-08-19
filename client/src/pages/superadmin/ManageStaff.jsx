// client/src/pages/superadmin/ManageStaff.jsx
//
// Super Admin's one screen: invite a Content Manager or another Super
// Admin by email, view active staff, revoke access. Talks to
// /api/super-admin/staff — every request is guarded server-side by
// requireSuperAdmin regardless of what this UI shows or hides.

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { ShieldCheck, Trash2 } from "lucide-react";
import Title from "../../components/Title";
import { useAppContext } from "../../context/AppContext";
import usePageTitle from "../../hooks/usePageTitle";

const ROLE_LABELS = {
  content_manager: "Content Manager",
  super_admin: "Super Admin",
};

const ManageStaff = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Staff");

  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [role, setRole]   = useState("content_manager");

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get("/api/super-admin/staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setStaff(data.staff);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load staff accounts");
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/super-admin/staff",
        { email: trimmedEmail, name: name.trim(), role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success("Staff account created");
        setEmail("");
        setName("");
        setRole("content_manager");
        fetchStaff();
      } else {
        toast.error(data.message || "Could not create staff account");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create staff account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id, staffEmail) => {
    if (!window.confirm(`Revoke access for ${staffEmail}? This can be re-invited later.`)) {
      return;
    }
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/super-admin/staff/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        toast.success("Access revoked");
        setStaff((prev) => prev.filter((s) => s._id !== id));
      } else {
        toast.error(data.message || "Could not revoke access");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not revoke access");
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <Title title="Manage Staff" subTitle="Grant or revoke Admin and Content Manager access." />
      </div>

      <form
        onSubmit={handleInvite}
        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6"
      >
        <h3 className="font-semibold text-gray-800 mb-4">Invite Staff</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border border-gray-300 rounded-lg px-3 py-2 w-full outline-indigo-500"
              placeholder="staff@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full outline-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full outline-indigo-500 bg-white"
            >
              <option value="content_manager">Content Manager</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className={`px-5 py-2 rounded-lg text-white font-medium transition ${
            submitting ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {submitting ? "Inviting..." : "Invite"}
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <h3 className="font-semibold text-gray-800 px-6 pt-6 mb-4">Active Staff</h3>
        {loading ? (
          <p className="text-sm text-gray-400 px-6 pb-6">Loading...</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400 px-6 pb-6">No staff accounts yet.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-gray-400 bg-gray-50">
              <tr>
                <th className="px-6 py-2 font-semibold">Email</th>
                <th className="px-6 py-2 font-semibold">Name</th>
                <th className="px-6 py-2 font-semibold">Role</th>
                <th className="px-6 py-2 font-semibold">Status</th>
                <th className="px-6 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{s.email}</td>
                  <td className="px-6 py-3">{s.name || "—"}</td>
                  <td className="px-6 py-3">{ROLE_LABELS[s.role] || s.role}</td>
                  <td className="px-6 py-3">
                    {s.clerkUserId ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-amber-600 text-xs font-medium">Invited (pending sign-in)</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(s._id, s.email)}
                      className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ManageStaff;