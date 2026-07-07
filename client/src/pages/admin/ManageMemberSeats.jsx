// client/src/pages/admin/ManageMemberSeats.jsx
//
// Admin interface for managing MemberSeat records.
// These are the pre-registration records that control who can sign up.
//
// Rules enforced in UI:
//   - Claimed seats show a lock icon; membershipNo and joinDate are read-only
//   - Unclaimed seats can be fully edited or deleted
//   - Claimed seats cannot be deleted

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast  } from "react-hot-toast";
import {
  Plus, Edit2, Trash2, Lock, Unlock,
  Loader2, Search, CheckCircle2, Clock,
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import usePageTitle      from "../../hooks/usePageTitle";

const EMPTY_FORM = {
  membershipNo: "",
  name:         "",
  plotNo:       "",
  designation:  "",
  joinDate:     "",
};

export default function ManageMemberSeats() {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage Member Seats");

  const [seats,       setSeats]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [editingSeat, setEditingSeat] = useState(null); // null = add mode, seat obj = edit mode
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [showForm,    setShowForm]    = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSeats = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/admin/seats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setSeats(data.seats);
    } catch {
      toast.error("Failed to load member seats");
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => { fetchSeats(); }, [fetchSeats]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingSeat(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (seat) => {
    setEditingSeat(seat);
    setForm({
      membershipNo: seat.membershipNo,
      name:         seat.name,
      plotNo:       seat.plotNo || "",
      designation:  seat.designation || "",
      // Format date as YYYY-MM-DD for the input
      joinDate: seat.joinDate
        ? new Date(seat.joinDate).toISOString().slice(0, 10)
        : "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSeat(null);
    setForm(EMPTY_FORM);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.membershipNo.trim()) {
      toast.error("Membership number is required");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.joinDate) {
      toast.error("Join date is required");
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();

      if (editingSeat) {
        const { data } = await axios.put(
          `/api/admin/seats/${editingSeat._id}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (data.success) {
          setSeats(prev => prev.map(s => s._id === editingSeat._id ? data.seat : s));
          toast.success("Seat updated");
          closeForm();
        }
      } else {
        const { data } = await axios.post(
          "/api/admin/seats",
          form,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (data.success) {
          setSeats(prev => [data.seat, ...prev]);
          toast.success("Seat created");
          closeForm();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save seat");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (seat) => {
    if (seat.isClaimed) {
      toast.error("Cannot delete a claimed seat — member account exists");
      return;
    }
    if (!window.confirm(`Delete seat for ${seat.membershipNo} (${seat.name})?`)) return;

    setDeleting(seat._id);
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/admin/seats/${seat._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setSeats(prev => prev.filter(s => s._id !== seat._id));
        toast.success("Seat deleted");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete seat");
    } finally {
      setDeleting(null);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = seats.filter(s =>
    s.membershipNo.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const claimed   = seats.filter(s =>  s.isClaimed).length;
  const unclaimed = seats.filter(s => !s.isClaimed).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-playfair text-2xl font-semibold text-gray-900">
            Member Seats
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-outfit">
            Pre-register membership numbers. Only members listed here can complete sign-up.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-gray-400">
              <span className="font-semibold text-gray-700">{seats.length}</span> total ·{" "}
              <span className="font-semibold text-emerald-600">{claimed}</span> claimed ·{" "}
              <span className="font-semibold text-amber-600">{unclaimed}</span> unclaimed
            </span>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)]
            hover:bg-blue-700 text-white text-sm font-semibold rounded-xl
            shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Seat
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by membership number or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl
            text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
            focus:border-[var(--color-primary)]"
        />
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0  }}
          className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6"
        >
          <h3 className="font-playfair text-base font-semibold text-gray-800 mb-4">
            {editingSeat ? `Edit Seat — ${editingSeat.membershipNo}` : "Add New Seat"}
          </h3>

          {editingSeat?.isClaimed && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2
              bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <Lock className="h-3.5 w-3.5 flex-shrink-0" />
              This seat is claimed. Membership number and join date are locked.
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Membership Number *
                </label>
                <input
                  type="text"
                  value={form.membershipNo}
                  onChange={e => setForm(f => ({ ...f, membershipNo: e.target.value.toUpperCase() }))}
                  readOnly={editingSeat?.isClaimed}
                  placeholder="e.g. MEM-2024-001"
                  className={`w-full px-3 py-2 text-sm border rounded-xl outline-none
                    focus:ring-2 focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)]
                    ${editingSeat?.isClaimed
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-default"
                      : "bg-white border-gray-200"
                    }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Member's full name"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Plot Number
                </label>
                <input
                  type="text"
                  value={form.plotNo}
                  onChange={e => setForm(f => ({ ...f, plotNo: e.target.value }))}
                  placeholder="e.g. Plot-13"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Designation
                </label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. Deputy Secretary"
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Join Date *
                  <span className="text-gray-400 font-normal ml-1">
                    — dues generated from this date
                  </span>
                </label>
                <input
                  type="date"
                  value={form.joinDate}
                  onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))}
                  readOnly={editingSeat?.isClaimed}
                  max={new Date().toISOString().slice(0, 10)}
                  className={`w-full px-3 py-2 text-sm border rounded-xl outline-none
                    focus:ring-2 focus:ring-[var(--color-primary)]/20
                    focus:border-[var(--color-primary)]
                    ${editingSeat?.isClaimed
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-default"
                      : "bg-white border-gray-200"
                    }`}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5
                  bg-[var(--color-primary)] hover:bg-blue-700
                  text-white text-sm font-semibold rounded-xl
                  transition-colors disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : editingSeat ? "Update Seat" : "Create Seat"
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
        </motion.div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">
            {search ? "No seats match your search." : "No seats yet. Add the first one above."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="text-xs uppercase text-gray-400 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Membership No</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Plot</th>
                <th className="px-4 py-3 font-semibold">Join Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(seat => (
                <tr key={seat._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    {seat.membershipNo}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{seat.name}</td>
                  <td className="px-4 py-3 text-gray-500">{seat.plotNo || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {seat.joinDate
                      ? new Date(seat.joinDate).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })
                      : "—"
                    }
                  </td>
                  <td className="px-4 py-3">
                    {seat.isClaimed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1
                        bg-emerald-50 text-emerald-700 text-[10px] font-semibold
                        rounded-full border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Claimed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1
                        bg-amber-50 text-amber-700 text-[10px] font-semibold
                        rounded-full border border-amber-200">
                        <Clock className="h-3 w-3" />
                        Unclaimed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(seat)}
                        className="p-1.5 rounded-lg text-gray-400
                          hover:text-[var(--color-primary)] hover:bg-blue-50
                          transition-colors"
                        title="Edit seat"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(seat)}
                        disabled={seat.isClaimed || deleting === seat._id}
                        className="p-1.5 rounded-lg text-gray-400
                          hover:text-red-500 hover:bg-red-50 transition-colors
                          disabled:opacity-30 disabled:cursor-not-allowed"
                        title={seat.isClaimed ? "Cannot delete a claimed seat" : "Delete seat"}
                      >
                        {deleting === seat._id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2  className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}