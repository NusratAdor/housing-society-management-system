import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import Title from "../components/Title";
import { noticesDummyData } from "../assets/assets";
import { motion } from "framer-motion";

const MemberDashboard = () => {
  const { user } = useUser();
  const [profile, setProfile] = useState({
    name: "",
    address: "",
    designation: "",
    email: "",
    phone: "",
    membershipNumber: "",
    plotNumber: "",
    paymentStatus: "Due",
  });
  const [question, setQuestion] = useState("");
  const [submittedQuestions, setSubmittedQuestions] = useState([]);
  const [notices, setNotices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  useEffect(() => {
    setProfile({
      name: user?.fullName || "John Doe",
      address: "123 Harmony Lane",
      designation: "Resident",
      email: user?.emailAddresses[0]?.emailAddress || "john.doe@example.com",
      phone: "+91-9876543210",
      membershipNumber: "HS001",
      plotNumber: "A-101",
      paymentStatus: "Due",
    });

    setNotices(noticesDummyData);

    setNotifications([
      { id: "1", message: "Payment due on 2025-08-10", date: "2025-07-30" },
      { id: "2", message: "New notice posted", date: "2025-07-29" },
    ]);

    setPaymentHistory([
      { id: "1", amount: 5000, date: "2025-06-01", status: "Paid" },
      { id: "2", amount: 5000, date: "2025-07-01", status: "Due" },
      { id: "3", amount: 5000, date: "2025-08-01", status: "Pending" },
    ]);
  }, [user]);

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    setSubmissionStatus({ type: "profile", message: "Profile updated successfully!" });
    setTimeout(() => setSubmissionStatus(null), 3000);
  };

  const handleQuestionSubmit = (e) => {
    e.preventDefault();
    if (question.trim()) {
      const submitted = {
        question,
        askedBy: profile.name,
        askedAt: new Date().toLocaleString(),
      };
      setSubmittedQuestions([...submittedQuestions, submitted]);
      setSubmissionStatus({ type: "question", message: "Question submitted! Admin will respond soon." });
      setQuestion("");
      setTimeout(() => setSubmissionStatus(null), 3000);
    }
  };

  return (
    <div className="w-full bg-white py-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <Title
          title="Member Dashboard"
          subTitle="Manage your profile, view notices, submit questions, and track payments."
        />

        {submissionStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-100 text-green-700 rounded-md font-outfit"
          >
            {submissionStatus.message}
          </motion.div>
        )}

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Profile Details</h3>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {[
                ["Name", "name"],
                ["Address", "address"],
                ["Designation", "designation"],
                ["Email", "email", true],
                ["Phone", "phone"],
                ["Membership Number", "membershipNumber", true],
                ["Plot Number", "plotNumber"],
                ["Payment Status", "paymentStatus", true],
              ].map(([label, key, readOnly]) => (
                <div key={key}>
                  <label className="block text-sm text-gray-600 mb-1 font-outfit">{label}</label>
                  <input
                    type="text"
                    value={profile[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    readOnly={readOnly}
                    className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)] ${
                      readOnly ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                </div>
              ))}
              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700 transition-all"
              >
                Update Profile
              </button>
            </form>
          </motion.div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Recent Notices */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
            >
              <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Recent Notices</h3>
              <div className="space-y-4">
                {notices.slice(0, 3).map((notice) => (
                  <Link
                    key={notice._id}
                    to={`/notices/${notice._id}`}
                    className="block p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)] transition-all"
                  >
                    <div className="flex gap-4">
                      {notice.image && (
                        <img
                          src={notice.image}
                          alt={notice.title}
                          className="h-16 w-16 object-cover rounded-md"
                        />
                      )}
                      <div>
                        <h4 className="font-playfair text-base font-semibold text-gray-800">{notice.title}</h4>
                        <p className="text-gray-600 font-outfit text-sm">{notice.date}</p>
                        <p className="text-gray-600 font-outfit text-sm">{notice.summary}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Question Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
            >
              <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Submit a Question</h3>
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
                  className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700 transition-all"
                >
                  Submit Question
                </button>
              </form>
              {submittedQuestions.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2 text-gray-700">Submitted Questions</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                    {submittedQuestions.map((q, index) => (
                      <li key={index}>
                        {q.question}{" "}
                        <span className="text-xs text-gray-400">({q.askedAt})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Payment History and Notifications */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Payment History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Payment History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="py-2 px-4">Date</th>
                    <th className="py-2 px-4">Amount</th>
                    <th className="py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id} className="border-t border-gray-100">
                      <td className="py-2 px-4">{payment.date}</td>
                      <td className="py-2 px-4">৳{payment.amount}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                            payment.status === "Paid"
                              ? "bg-green-100 text-green-700"
                              : payment.status === "Due"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white border border-gray-200 rounded-md p-6 shadow-md"
          >
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Notifications</h3>
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-all font-outfit"
                >
                  {notification.message}{" "}
                  <span className="text-xs text-gray-400">({notification.date})</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
