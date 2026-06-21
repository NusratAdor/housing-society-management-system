// client/src/pages/admin/tabs/PendingPayments.jsx
// Lists payments with status "pending" awaiting admin review.
// Polls every 60 seconds so the badge count stays current.
// Admin can reject with a mandatory reason.
// Approval is handled automatically by SSLCommerz IPN —
// admin rejection is for edge cases (dispute, fraud, etc.)

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button }       from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppContext } from "../../../context/AppContext";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function PendingPayments({ onCountChange }) {
  const { axios, getToken } = useAppContext();

  const [payments,        setPayments]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [rejectDialog,    setRejectDialog]    = useState(null); // { paymentId, memberName }
  const [rejectReason,    setRejectReason]    = useState("");
  const [rejecting,       setRejecting]       = useState(false);

  const fetchPending = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setPayments(data.payments);
        onCountChange?.(data.payments.length);
      }
    } catch {
      if (!silent) toast.error("Failed to load pending payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [axios, getToken, onCountChange]);

  useEffect(() => {
    fetchPending(false);
    const interval = setInterval(() => fetchPending(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const openReject = (payment) => {
    setRejectDialog({
      paymentId:  payment._id,
      memberName: payment.member?.name || "this member",
      amount:     payment.amount,
    });
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setRejecting(true);
    try {
      const token = await getToken();
      const { data } = await axios.put(
        `/api/payments/${rejectDialog.paymentId}/reject`,
        { rejectedReason: rejectReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setPayments(prev => prev.filter(p => p._id !== rejectDialog.paymentId));
        onCountChange?.(payments.length - 1);
        toast.success("Payment rejected");
        setRejectDialog(null);
      } else {
        toast.error(data.message || "Failed to reject payment");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Error rejecting payment");
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-playfair text-base font-semibold text-gray-800">
            Pending Payments
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} awaiting
            gateway confirmation
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPending(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200
        rounded-xl mb-4 text-sm text-blue-700">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          Payments are confirmed automatically via SSLCommerz IPN.
          Use Reject only for disputed or erroneous payment sessions.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No pending payments</p>
          <p className="text-sm mt-1">All payments are up to date</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {payments.map(payment => (
              <motion.div
                key={payment._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between p-4 border
                  border-amber-200 rounded-xl bg-amber-50/40 gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">
                      {payment.member?.name || "Unknown"}
                    </p>
                    <span className="text-xs text-gray-400 font-mono">
                      {payment.member?.membershipNo}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ৳{payment.amount.toLocaleString()} ·{" "}
                    {new Date(payment.createdAt).toLocaleString("en-GB")}
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                    {payment.transactionId}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReject(payment)}
                  className="text-red-600 border-red-200 hover:bg-red-50
                    hover:border-red-400 flex-shrink-0 gap-1.5"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Reject dialog */}
      <AlertDialog
        open={!!rejectDialog}
        onOpenChange={open => { if (!open) setRejectDialog(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Reject ৳{rejectDialog?.amount?.toLocaleString()} payment from{" "}
              <strong>{rejectDialog?.memberName}</strong>?
              A rejection reason is required and will be shown to the member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (required)..."
              className="w-full p-3 border border-gray-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 gap-1.5"
            >
              {rejecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}