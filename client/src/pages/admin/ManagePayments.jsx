// pages/admin/ManagePayments.jsx
import React, { useEffect, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { toast } from "react-hot-toast";
import Title from "../../components/Title";
import { formatDate } from "../../utils/formatDate";

const ManagePayments = () => {
  const { axios, getToken } = useAppContext();
  const [pending, setPending] = useState([]);

  const fetchPending = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setPending(data.payments);
    } catch (err) {
      toast.error("Failed to load pending payments");
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this payment?")) return;
    try {
      const token = await getToken();
      const { data } = await axios.patch(`/api/payments/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setPending((prev) => prev.filter((p) => p._id !== id));
        toast.success("Payment approved");
      }
    } catch (err) {
      toast.error("Approval failed");
    }
  };

 const handleReject = async (id) => {
  const reasonText = window.prompt("Reject reason:", "");
  if (!reasonText?.trim()) return;

  try {
    const token = await getToken();
    const { data } = await axios.patch(
      `/api/payments/${id}/reject`,
      { rejectedReason: reasonText }, // SEND IN BODY
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (data.success) {
      setPending((prev) => prev.filter((p) => p._id !== id));
      toast.success("Payment rejected");
    }
  } catch (err) {
    console.error("Reject error:", err.response?.data);
    toast.error(err.response?.data?.message || "Rejection failed");
  }
};

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [getToken]);

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Title title="Manage Payments" subTitle="Review and approve member payments" />
        
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">Member</th>
                <th className="border border-gray-300 px-4 py-2">Month</th>
                <th className="border border-gray-300 px-4 py-2">Method</th>
                <th className="border border-gray-300 px-4 py-2">Tx ID</th>
                <th className="border border-gray-300 px-4 py-2">Submitted</th>
                <th className="border border-gray-300 px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">{p.member.name}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.month}/{p.year}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.method}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.transactionId}</td>
                  <td className="border border-gray-300 px-4 py-2">{formatDate(p.createdAt)}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <button onClick={() => handleApprove(p._id)} className="bg-green-500 text-white px-2 py-1 mr-1 rounded">Approve</button>
                    <button onClick={() => handleReject(p._id)} className="bg-red-500 text-white px-2 py-1 rounded">Reject</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-4">No pending payments</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagePayments;