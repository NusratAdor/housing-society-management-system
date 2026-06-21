// client/src/pages/admin/tabs/CustomCharges.jsx
// Admin creates extra charges for one, multiple, or all members.
// Shows the list of all charges with batch grouping.
//
// ADDED: search over the charge list (label, member name, amount).
// Search is purely client-side over the already-fetched `charges` array —
// no new API calls, no change to fetch/create/cancel logic.

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  Plus,
  Trash2,
  Users,
  User,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useAppContext } from "../../../context/AppContext";

const STATUS_STYLES = {
  Unpaid: "bg-red-50    text-red-600    border-red-200",
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-gray-100  text-gray-500   border-gray-200",
};

export default function CustomCharges() {
  const { axios, getToken } = useAppContext();

  const [charges, setCharges] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [form, setForm] = useState({
    label: "",
    purpose: "",
    amount: "",
    dueDate: "",
    targetType: "all",
    memberIds: [],
  });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchCharges = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const h = { Authorization: `Bearer ${token}` };
      const [chargesRes, membersRes] = await Promise.all([
        axios.get("/api/charges?limit=100", { headers: h }),
        axios.get("/api/admin/members", { headers: h }),
      ]);
      if (chargesRes.data.success) setCharges(chargesRes.data.charges);
      if (membersRes.data.success) setMembers(membersRes.data.members);
    } catch {
      toast.error("Failed to load charges");
    } finally {
      setLoading(false);
    }
  }, [axios, getToken]);

  useEffect(() => {
    fetchCharges();
  }, [fetchCharges]);

  // ── Submit new charge ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.label.trim() || !form.purpose.trim()) {
      toast.error("Label and purpose are required");
      return;
    }
    if (!form.amount || isNaN(form.amount) || Number(form.amount) < 1) {
      toast.error("Enter a valid amount");
      return;
    }
    if (
      (form.targetType === "single" || form.targetType === "multiple") &&
      form.memberIds.length === 0
    ) {
      toast.error("Select at least one member");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/charges",
        {
          label: form.label.trim(),
          purpose: form.purpose.trim(),
          amount: Number(form.amount),
          dueDate: form.dueDate || undefined,
          targetType: form.targetType,
          memberIds: form.memberIds,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        toast.success(data.message);
        setForm({
          label: "",
          purpose: "",
          amount: "",
          dueDate: "",
          targetType: "all",
          memberIds: [],
        });
        fetchCharges();
      } else {
        toast.error(data.message || "Failed to create charge");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Error creating charge");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel charge ─────────────────────────────────────────────────────────
  const handleCancel = async () => {
    setCancelling(true);
    try {
      const token = await getToken();
      const { data } = await axios.delete(
        `/api/charges/${cancelDialog.chargeId}`,
        {
          data: { cancelReason: cancelReason.trim() },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        setCharges((prev) =>
          prev.map((c) =>
            c._id === cancelDialog.chargeId ? { ...c, status: "Cancelled" } : c,
          ),
        );
        toast.success("Charge cancelled");
        setCancelDialog(null);
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Error cancelling charge");
    } finally {
      setCancelling(false);
    }
  };

  const handleMemberSelect = (e) => {
    const id = e.target.value;
    if (!id) return;
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds
        : [...prev.memberIds, id],
    }));
  };

  const removeMemberId = (id) => {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.filter((m) => m !== id),
    }));
  };

  const memberNameById = (id) => members.find((m) => m._id === id)?.name || id;

  // ── Search filter ────────────────────────────────────────────────────────
  // Client-side filter over the already-fetched charges list.
  // Matches: charge label, assigned member's name, or amount.
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredCharges = normalizedSearch
    ? charges.filter((charge) => {
        const labelMatch = charge.label
          ?.toLowerCase()
          .includes(normalizedSearch);
        const memberMatch = charge.member?.name
          ?.toLowerCase()
          .includes(normalizedSearch);
        const amountMatch = String(charge.amount).includes(normalizedSearch);
        return labelMatch || memberMatch || amountMatch;
      })
    : charges;

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white border border-gray-200 rounded-xl
            p-6 shadow-sm h-fit"
        >
          <h3 className="font-playfair text-base font-semibold text-gray-800 mb-5">
            Create Extra Charge
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Charge Label *
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Generator Repair"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Purpose / Reason *
                <span className="text-gray-400 font-normal ml-1">
                  (shown to members)
                </span>
              </label>
              <textarea
                value={form.purpose}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purpose: e.target.value }))
                }
                placeholder="Explain why this charge is being added..."
                rows={3}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                  resize-none"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Amount (BDT) *
              </label>
              <input
                type="number"
                min="1"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
              />
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Due Date
                <span className="text-gray-400 font-normal ml-1">
                  (optional)
                </span>
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* Target type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Assign To *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    value: "all",
                    label: "All Members",
                    icon: <Users className="h-3.5 w-3.5" />,
                  },
                  {
                    value: "multiple",
                    label: "Multiple",
                    icon: <Users className="h-3.5 w-3.5" />,
                  },
                  {
                    value: "single",
                    label: "One Member",
                    icon: <User className="h-3.5 w-3.5" />,
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        targetType: opt.value,
                        memberIds: [],
                      }))
                    }
                    className={`flex items-center justify-center gap-1.5 py-2 px-2
                      rounded-lg border text-xs font-medium transition-all ${
                        form.targetType === opt.value
                          ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Member selector for single/multiple */}
            {(form.targetType === "single" ||
              form.targetType === "multiple") && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Select Member{form.targetType === "multiple" ? "s" : ""} *
                </label>
                <select
                  onChange={handleMemberSelect}
                  value=""
                  className="w-full p-2.5 border border-gray-300 rounded-lg
                    text-sm focus:outline-none focus:ring-2
                    focus:ring-[var(--color-primary)]"
                >
                  <option value="">— Choose a member —</option>
                  {members
                    .filter((m) => !form.memberIds.includes(m._id))
                    .map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.membershipNo})
                      </option>
                    ))}
                </select>

                {/* Selected member chips */}
                {form.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.memberIds.map((id) => (
                      <span
                        key={id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-50
                          text-blue-700 text-xs rounded-full border border-blue-200"
                      >
                        {memberNameById(id)}
                        <button
                          type="button"
                          onClick={() => removeMemberId(id)}
                          className="text-blue-400 hover:text-red-500 ml-0.5
                            leading-none font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--color-primary)] hover:bg-blue-700 gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Create Charge
                </>
              )}
            </Button>
          </form>
        </motion.div>

        {/* ── Charge list ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-playfair text-base font-semibold text-gray-800">
                All Charges
              </h3>
              <Badge variant="secondary">
                {normalizedSearch
                  ? `${filteredCharges.length} of ${charges.length}`
                  : `${charges.length} total`}
              </Badge>
            </div>

            {/* Search — label, member name, or amount */}
            <div className="relative w-full sm:w-72 lg:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by label, member or amount"
                className="pl-9 w-full text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : filteredCharges.length === 0 ? (
            <div
              className="text-center py-16 text-gray-400 border border-dashed
              border-gray-200 rounded-xl"
            >
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              {charges.length === 0 ? (
                <>
                  <p className="font-medium">No charges yet</p>
                  <p className="text-sm mt-1">Create one using the form</p>
                </>
              ) : (
                <>
                  <p className="font-medium">No matching charges</p>
                  <p className="text-sm mt-1">
                    Try a different label, member, or amount
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {filteredCharges.map((charge) => (
                <div
                  key={charge._id}
                  className="p-4 border border-gray-200 rounded-xl
                    hover:border-gray-300 transition-all bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">
                          {charge.label}
                        </p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5
                          rounded-full border ${STATUS_STYLES[charge.status]}`}
                        >
                          {charge.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {charge.purpose}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-700">
                          ৳{charge.amount.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400">
                          → {charge.member?.name || "—"}
                        </span>
                        {charge.dueDate && (
                          <span className="text-xs text-orange-500">
                            Due{" "}
                            {new Date(charge.dueDate).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(charge.createdAt).toLocaleDateString(
                            "en-GB",
                          )}
                        </span>
                      </div>
                    </div>
                    {charge.status === "Unpaid" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCancelDialog({
                            chargeId: charge._id,
                            chargeLabel: charge.label,
                            memberName: charge.member?.name || "member",
                          });
                          setCancelReason("");
                        }}
                        className="text-red-500 border-red-200 hover:bg-red-50
                          flex-shrink-0 gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Cancel dialog */}
      <AlertDialog
        open={!!cancelDialog}
        onOpenChange={(open) => {
          if (!open) setCancelDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Charge</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel <strong>"{cancelDialog?.chargeLabel}"</strong> for{" "}
              <strong>{cancelDialog?.memberName}</strong>? This sets the charge
              to Cancelled — the record is kept for audit. A reason is optional
              but recommended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Cancellation reason (optional)..."
              className="w-full p-3 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 gap-1.5"
            >
              {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Cancel Charge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
