// pages/MemberDashboard.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import Title from "../components/Title";
import { useAppContext } from "../context/AppContext";
import { formatDate } from "../utils/formatDate";
import { useLocation } from "react-router-dom";

// Helper: compute the last 3 months with payment status
const getLastThreeMonths = (payments = []) => {
  const now = new Date();
  const months = [];

  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleString("default", { month: "long" });
    const year = d.getFullYear();

    // Look for paid payment in this month/year
    const paid = payments.some(
      (p) =>
        p.status === "Paid" &&
        p.month === d.getMonth() + 1 &&
        p.year === year
    );

    months.push({
      month,
      year,
      status: paid ? "Paid" : "Unpaid",
    });
  }
  return months;
};

const MemberDashboard = () => {
  const {
    user,
    memberProfile,
    loadingProfile,
    fetchMemberProfile,
    axios,
    getToken,
    navigate,
  } = useAppContext();

  useEffect(() => {
    if (!loadingProfile && !memberProfile) {
      navigate("/create-profile", { replace: true });
    }
  }, [memberProfile, loadingProfile, navigate]);

  // ── Profile ─────────────────────────────────────
  const [profile, setProfile] = useState({
    name: "",
    address: "",
    designation: "",
    email: "",
    phone: "",
    membershipNumber: "",
    plotNumber: "",
    paymentStatus: "Pending",
    pendingAdmin: false,
  });
  // ── Questions & FAQs ─────────────────────────────
  const [question, setQuestion] = useState("");
  const [submittedQuestions, setSubmittedQuestions] = useState([]);
  const [answeredFAQs, setAnsweredFAQs] = useState([]);
  // ── Notices & Notifications ──────────────────────
  const [notices, setNotices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  // ── Payments ─────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState("");
  const [loadingPayment, setLoadingPayment] = useState(false);
  const location = useLocation();
  const monthlyFee = 300;
  // ── Fetch helpers ─────────────────────────────────
  const fetchNotices = async () => {
    try {
      const { data } = await axios.get("/api/notices");
      if (data.success) setNotices(data.notices.slice(0, 3));
    } catch {
      toast.error("Failed to load notices");
    }
  };
  const fetchAnsweredFAQs = async () => {
    try {
      const { data } = await axios.get("/api/faqs");
      if (data.success) setAnsweredFAQs(data.faqs);
    } catch {
      toast.error("Failed to load answered FAQs");
    }
  };
  const fetchMemberNotifications = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/notifications/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setNotifications(data.notifications);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };
  const fetchPayments = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/payments/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setPayments(data.payments);
    } catch (err) {
      console.error("Fetch payments error:", err);
    }
  };
  // ── Question handling ─────────────────────────────
  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/faqs/pending",
        { question },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setSubmittedQuestions((prev) => [
          ...prev,
          { question, askedAt: new Date().toISOString() },
        ]);
        setQuestion("");
        toast.success("Question submitted!");
      }
    } catch {
      toast.error("Failed to submit question");
    }
  };
  const handleDeleteSubmitted = (index) => {
    if (!window.confirm("Delete this submitted question?")) return;
    setSubmittedQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.success("Question deleted");
  };
  const handleDeleteAnswered = async (faqId) => {
    if (!window.confirm("Delete this answered FAQ?")) return;
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/faqs/member/${faqId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setAnsweredFAQs((prev) => prev.filter((f) => f._id !== faqId));
        toast.success("FAQ deleted");
      }
    } catch (err) {
      console.error("Delete FAQ error:", err);
      toast.error("Failed to delete FAQ");
    }
  };
  // ── Profile handling ─────────────────────────────
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = await getToken();
      const email =
        memberProfile?.email || user?.primaryEmailAddress?.emailAddress;
      if (!email) {
        toast.error("No primary email found in profile");
        return;
      }
      const { data } = await axios.post(
        "/api/members",
        {
          name: profile.name,
          email,
          phone: profile.phone,
          address: profile.address,
          designation: profile.designation,
          membershipNo: profile.membershipNumber,
          plotNo: profile.plotNumber,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message || "Profile updated successfully!");
        fetchMemberProfile();
      } else {
        toast.error(data.message || "Could not update profile");
      }
    } catch (error) {
      const message = error.response?.data?.message || "Error updating profile";
      toast.error(message);
    }
  };
  const handleRequestAdmin = async () => {
    if (profile.pendingAdmin) {
      toast.error("Admin request already pending");
      return;
    }
    if (memberProfile?.role === "admin") {
      toast.error("You are already an admin");
      return;
    }
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/members/request-admin",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message || "Admin request submitted successfully!");
        setProfile({ ...profile, pendingAdmin: true });
        fetchMemberProfile();
      } else {
        toast.error(data.message || "Failed to submit admin request");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Error submitting admin request"
      );
    }
  };
  // ── PAYMENT GATEWAY (SSLCOMMERZ) ─────────────────
  const handleGatewayPay = async () => {
  if (!amount || amount <= 0) {
    toast.error("Please enter a valid amount.");
    return;
  }

  setLoadingPayment(true);
  try {
    const token = await getToken();
    const { data } = await axios.post(
      "/api/payments/create",
      { amount: Number(amount) },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (data.success && data.url) {
      window.location.href = data.url;
    } else {
      toast.error(data.message || "Payment initialization failed");
    }
  } catch (err) {
    console.error("Payment error:", err.response?.data || err);
    toast.error(err.response?.data?.message || "Failed to start payment");
  } finally {
    setLoadingPayment(false);
  }
};
  // ── Effects ───────────────────────────────────────
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const status = params.get("payment_status");

  if (status === "VALID") {
    fetchPayments();
    fetchMemberProfile();
    toast.success("Payment successful! Due updated.");
    window.history.replaceState({}, "", "/dashboard");
  } else if (status === "FAILED" || status === "CANCEL") {
    toast.error("Payment failed or cancelled.");
    window.history.replaceState({}, "", "/dashboard");
  }
}, [location.search, fetchPayments, fetchMemberProfile]);

  useEffect(() => {
    fetchNotices();
    fetchAnsweredFAQs();
    fetchMemberNotifications();
    fetchPayments();
    const interval = setInterval(() => {
      fetchNotices();
      fetchMemberNotifications();
    }, 30_000);
    return () => clearInterval(interval);
  }, [getToken]);
  useEffect(() => {
    if (user && memberProfile) {
      setProfile({
        name: memberProfile.name || "",
        address: memberProfile.address || "",
        designation: memberProfile.designation || "",
        email:
          memberProfile.email || user?.primaryEmailAddress?.emailAddress || "",
        phone: memberProfile.phone || "",
        membershipNumber: memberProfile.membershipNo || "",
        plotNumber: memberProfile.plotNo || "",
        paymentStatus: memberProfile.paymentStatus || "Pending",
        pendingAdmin: memberProfile.pendingAdmin || false,
      });
    }
  }, [user, memberProfile]);
  // ── CRITICAL: Wait for profile & show loading ─────
  if (loadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg font-outfit">Loading profile...</div>
      </div>
    );
  }
  if (!memberProfile) {
    return null; // AppContext handles redirect
  }
  // ── UI helpers ─────────────────────────────────────
  const formFields = [
    { label: "Name", key: "name" },
    { label: "Address", key: "address" },
    { label: "Designation", key: "designation" },
    { label: "Email", key: "email", readOnly: true },
    { label: "Phone", key: "phone" },
    { label: "Membership Number", key: "membershipNumber", readOnly: true },
    { label: "Plot Number", key: "plotNumber" },
    { label: "Payment Status", key: "paymentStatus", readOnly: true },
  ];

  const lastThree = getLastThreeMonths(payments);

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Title
          title="Member Dashboard"
          subTitle="Manage your profile, view notices, submit questions, and track payments."
        />
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── PROFILE ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
              Profile Details
            </h3>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {formFields.map(({ label, key, readOnly }) => (
                <div key={key}>
                  <label className="block text-sm text-gray-600 mb-1 font-outfit">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={profile[key]}
                    onChange={(e) =>
                      setProfile({ ...profile, [key]: e.target.value })
                    }
                    readOnly={readOnly}
                    className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)] ${
                      readOnly ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                </div>
              ))}
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700"
                >
                  Update Profile
                </button>
                <button
                  type="button"
                  onClick={handleRequestAdmin}
                  disabled={
                    profile.pendingAdmin || memberProfile?.role === "admin"
                  }
                  className={`bg-green-500 text-white rounded-md py-2 px-4 font-outfit hover:bg-green-600 ${
                    profile.pendingAdmin || memberProfile?.role === "admin"
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {profile.pendingAdmin
                    ? "Admin Request Pending"
                    : memberProfile?.role === "admin"
                    ? "You Are Admin"
                    : "Request Admin"}
                </button>
              </div>
            </form>
          </motion.div>
          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-8">
            {/* Recent Notices */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
            >
              <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
                Recent Notices
              </h3>
              <div className="space-y-4">
                {notices.map((n) => (
                  <Link
                    key={n._id}
                    to={`/notices/${n._id}`}
                    className="block p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)]"
                  >
                    <div className="flex gap-4">
                      {n.image && (
                        <img
                          src={n.image}
                          alt={n.title}
                          className="h-16 w-16 object-cover rounded-md"
                        />
                      )}
                      <div>
                        <h4 className="font-playfair text-base font-semibold text-gray-800">
                          {n.title}
                        </h4>
                        <p className="text-gray-600 font-outfit text-sm">
                          {formatDate(n.date)}
                        </p>
                        <p className="text-gray-600 font-outfit text-sm">
                          {n.summary}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
            {/* Submit Question */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
            >
              <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
                Submit a Question
              </h3>
              <form onSubmit={handleQuestionSubmit} className="space-y-4">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter your question for the admin..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)] font-outfit"
                  rows="4"
                  required
                />
                <button
                  type="submit"
                  className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700"
                >
                  Submit Question
                </button>
              </form>
              {submittedQuestions.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2 text-gray-700">
                    Your Submitted Questions
                  </h4>
                  <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                    {submittedQuestions.map((q, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <div>
                          {q.question}{" "}
                          <span className="text-xs text-gray-400">
                            ({formatDate(q.askedAt)})
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSubmitted(i)}
                          className="text-red-500 hover:underline text-xs ml-2"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
            {/* Answered FAQs */}
            {answeredFAQs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
              >
                <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
                  Answered FAQs
                </h3>
                <div className="space-y-4">
                  {answeredFAQs.map((faq) => (
                    <div
                      key={faq._id}
                      className="p-4 border border-gray-200 rounded-md"
                    >
                      <h4 className="font-semibold text-gray-800">
                        {faq.question}
                      </h4>
                      <p className="text-gray-600">{faq.answer}</p>
                      <p className="text-xs text-gray-400">
                        Answered: {formatDate(faq.answeredAt)}
                      </p>
                      <button
                        onClick={() => handleDeleteAnswered(faq._id)}
                        className="text-red-500 hover:underline text-xs mt-2"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {/* Notifications */}
            {notifications.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
              >
                <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
                  Notifications
                </h3>
                <div className="space-y-4">
                  {notifications.map((n) => (
                    <div
                      key={n._id}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 font-outfit"
                    >
                      {n.content}{" "}
                      <span className="text-xs text-gray-400">
                        ({formatDate(n.createdAt)})
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
        {/* ── PAYMENT SECTION (SSLCOMMERZ GATEWAY) ───────────────────── */}
       
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-12 bg-white border border-gray-200 rounded-md p-6 shadow-md"
        >
          <div className="flex justify-between items-center mb-4">
    <h3 className="font-playfair text-lg font-semibold text-gray-800">
      Monthly Fee: 300 TK
    </h3>
    {memberProfile.dueAmount > 0 && (
      <div className="text-red-600 font-semibold">
        Due: ৳{memberProfile.dueAmount}
      </div>
    )}
  </div>

          <div className="flex gap-3 mb-4">
    <input
      type="number"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      placeholder={`Enter amount (e.g., ${memberProfile.dueAmount || 300})`}
      className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring focus:ring-blue-300"
      min="1"
    />
    <button
      onClick={handleGatewayPay}
      disabled={!amount || amount <= 0 || loadingPayment}
      className="bg-[var(--color-primary)] text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loadingPayment ? "Processing…" : "Pay Now"}
    </button>
  </div>

          {/* Updated Payment History Table */}
          <div className="mt-6 overflow-x-auto">
            <h4 className="font-semibold mb-2 text-gray-800">
              Last 3 Months Payment Status
            </h4>
            <table className="w-full text-sm text-left text-gray-700 border">
              <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                <tr>
                  <th className="py-2 px-4">Month</th>
                  <th className="py-2 px-4">Year</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {lastThree.map((m, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 px-4">{m.month}</td>
                    <td className="py-2 px-4">{m.year}</td>
                    <td className="py-2 px-4">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                          m.status === "Paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
export default MemberDashboard;
