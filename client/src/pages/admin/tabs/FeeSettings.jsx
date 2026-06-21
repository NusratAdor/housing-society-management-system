// client/src/pages/admin/tabs/FeeSettings.jsx
// Admin sets the monthly maintenance fee.
// Effective-from defaults to next month (safe for members already paid).
// Dev-only manual trigger for testing the cron job.

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { DollarSign, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "../../../context/AppContext";

export default function FeeSettings() {
  const { axios, getToken } = useAppContext();

  const [currentFee,  setCurrentFee]  = useState(null);
  const [amount,      setAmount]      = useState("");
  const [reason,      setReason]      = useState("");
  const [effectFrom,  setEffectFrom]  = useState("next");
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [triggering,  setTriggering]  = useState(false);

  const fetchCurrentFee = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/settings/monthly-fee");
      if (data.success) {
        setCurrentFee(data.monthlyFee);
        setAmount(String(data.monthlyFee));
      }
    } catch {
      toast.error("Failed to load current fee");
    } finally {
      setLoading(false);
    }
  }, [axios]);

  useEffect(() => { fetchCurrentFee(); }, [fetchCurrentFee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || Number(amount) < 1) {
      toast.error("Enter a valid fee amount");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const { data } = await axios.put(
        "/api/settings/monthly-fee",
        { amount: Number(amount), reason: reason.trim(), effectFrom },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message);
        setCurrentFee(Number(amount));
        setReason("");
      } else {
        toast.error(data.message || "Failed to update fee");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Error updating fee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/admin/trigger-monthly-due",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Trigger failed");
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-4">
        <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-xl space-y-6">

      {/* Current fee display */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-5 bg-emerald-50 border
          border-emerald-200 rounded-xl"
      >
        <div className="p-3 bg-emerald-100 rounded-xl">
          <DollarSign className="h-6 w-6 text-emerald-700" />
        </div>
        <div>
          <p className="text-xs text-emerald-600 font-medium">
            Current Monthly Fee
          </p>
          <p className="text-3xl font-bold text-emerald-800 font-playfair">
            ৳{currentFee?.toLocaleString()}
          </p>
        </div>
      </motion.div>

      {/* Update form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
      >
        <h3 className="font-playfair text-base font-semibold text-gray-800 mb-5">
          Update Monthly Fee
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              New Fee Amount (BDT) *
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Reason
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Annual revision approved by committee"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Effective From *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: "next",
                  label: "Next Month",
                  sub:   "Safe — members who already paid this month are unaffected",
                },
                {
                  value: "current",
                  label: "This Month",
                  sub:   "Use only when setting the fee for the first time",
                },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEffectFrom(opt.value)}
                  className={`text-left p-3 rounded-xl border text-sm
                    transition-all ${
                    effectFrom === opt.value
                      ? "border-[var(--color-primary)] bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className={`font-semibold ${
                    effectFrom === opt.value
                      ? "text-[var(--color-primary)]"
                      : "text-gray-700"
                  }`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    {opt.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {effectFrom === "current" && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border
              border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              This month's charges not yet generated will use the new fee.
              Members who already have a charge this month are unaffected —
              their charges were locked at creation time.
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--color-primary)] hover:bg-blue-700 gap-2"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : "Update Fee"
            }
          </Button>
        </form>
      </motion.div>

      {/* Dev-only trigger */}
      {import.meta.env.DEV && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-50 border border-dashed border-gray-300
            rounded-xl p-5"
        >
          <p className="text-xs font-semibold text-gray-500 uppercase
            tracking-wide mb-1">
            Development Only
          </p>
          <p className="text-sm text-gray-600 mb-3">
            Manually trigger the monthly charge generation for the current month.
            Equivalent to what the cron job runs on the 1st.
          </p>
          <Button
            variant="outline"
            onClick={handleTrigger}
            disabled={triggering}
            className="gap-2 text-sm"
          >
            {triggering
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Triggering…</>
              : "Trigger Monthly Dues Now"
            }
          </Button>
        </motion.div>
      )}
    </div>
  );
}