// client/src/pages/admin/tabs/VerifiedPayments.jsx
//
// The primary actionable payment queue: gateway-confirmed payments
// awaiting admin review. Confirming here is the ONLY action that marks
// a member's dues as paid, generates a receipt, and sends the
// notification/email — deliberately, so nothing affects a member's
// account without an admin explicitly reviewing it first.

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { CheckCircle2, XCircle, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppContext } from "../../../context/AppContext";

export default function VerifiedPayments({ onCountChange }) {
  const { axios, getToken } = useAppContext();

  const [payments,     setPayments]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [confirming,   setConfirming]   = useState(null); // paymentId
  const [rejectDialog, setRejectDialog] = useState(null); // { paymentId, memberName, amount }
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting,    setRejecting]    = useState(false);

  const fetchVerified = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/verified", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setPayments(data.payments);
        onCountChange?.(data.payments.length);
      }
    } catch {
      if (!silent) toast.error("Failed to load verified payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [axios, getToken, onCountChange]);

  useEffect(() => {
    fetchVerified(false);
    const interval = setInterval(() => fetchVerified(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchVerified]);

  const handleConfirm = async (payment) => {
    setConfirming(payment._id);
    try {
      const token = await getToken();
      const { data } = await axios.put(
        `/api/payments/${payment._id}/confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setPayments(prev => prev.filter(p => p._id !== payment._id));
        onCountChange?.(payments.length - 1);
        toast.success(data.message || "Payment confirmed");
        if (!data.emailSent) {
          toast(
            "Confirmation email could not be sent — you may want to notify the member directly.",
            { icon: "⚠️", duration: 6000 }
          );
        }
      } else {
        toast.error(data.message || "Failed to confirm payment");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Error confirming payment");
    } finally {
      setConfirming(null);
    }
  };

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-playfair text-base font-semibold text-gray-800">
            Verified Payments
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} confirmed by
            the gateway, awaiting your review
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchVerified(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200
        rounded-xl mb-4 text-sm text-emerald-700">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
        <p>
          The payment gateway has confirmed these transactions. Confirming here
          marks the member's dues as paid, issues a receipt, and notifies them.
          Nothing is applied to a member's account until you confirm.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">Nothing awaiting confirmation</p>
          <p className="text-sm mt-1">All verified payments have been reviewed</p>
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
                  border-emerald-200 rounded-xl bg-emerald-50/40 gap-4"
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
                    ৳{payment.amount.toLocaleString()} · verified{" "}
                    {new Date(payment.verifiedAt).toLocaleString("en-GB")}
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                    {payment.transactionId}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReject(payment)}
                    disabled={confirming === payment._id}
                    className="text-red-600 border-red-200 hover:bg-red-50
                      hover:border-red-400 gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleConfirm(payment)}
                    disabled={confirming === payment._id}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  >
                    {confirming === payment._id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />
                    }
                    Confirm
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

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