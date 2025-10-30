// pages/admin/ManageFAQs.jsx
import React, { useState, useEffect } from "react";
import Title from "../../components/Title";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { formatDate } from "../../utils/formatDate";

const ManageFAQs = () => {
  const { getToken } = useAuth();
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [formData, setFormData] = useState({
    _id: null,
    question: "",
    answer: "",
    askedBy: "",
    clerkUserId: "",
  });

  const fetchData = async () => {
    try {
      const token = await getToken();
      const [pRes, fRes] = await Promise.all([
        axios.get("/api/faqs/pending", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/faqs", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setPendingQuestions(pRes.data.pending || []);
      setFaqs(fRes.data.faqs || []);
    } catch (err) {
      toast.error("Failed to load FAQs");
    }
  };

  useEffect(() => {
    fetchData();
  }, [getToken]);

  const handleAnswer = (q) => {
    setFormData({
      _id: null,
      question: q.question,
      answer: "",
      askedBy: q.askedBy || "Member",
      clerkUserId: q.clerkUserId,
    });
  };

  const handleEdit = (faq) => {
    setFormData(faq);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = await getToken();
      if (formData._id) {
        const { data } = await axios.put(
          `/api/faqs/${formData._id}`,
          { answer: formData.answer },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setFaqs((prev) => prev.map((f) => (f._id === formData._id ? data.faq : f)));
          toast.success("FAQ updated");
        }
      } else {
        const { data } = await axios.post(
          "/api/faqs",
          {
            question: formData.question,
            answer: formData.answer,
            askedBy: formData.askedBy,
            clerkUserId: formData.clerkUserId,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setPendingQuestions((prev) => prev.filter((p) => p.question !== formData.question));
          setFaqs((prev) => [...prev, data.faq]);
          toast.success("Question answered");
        }
      }
      setFormData({ _id: null, question: "", answer: "", askedBy: "", clerkUserId: "" });
    } catch {
      toast.error("Failed to submit");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this FAQ?")) return;
    try {
      const token = await getToken();
      await axios.delete(`/api/faqs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFaqs((prev) => prev.filter((f) => f._id !== id));
      toast.success("FAQ deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleDeletePending = async (id) => {
    if (!window.confirm("Delete pending question?")) return;
    try {
      const token = await getToken();
      await axios.delete(`/api/faqs/pending/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingQuestions((prev) => prev.filter((p) => p._id !== id));
      toast.success("Pending question removed");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="w-full bg-white">
      <Title title="Manage FAQs" subTitle="Answer member questions and manage FAQs." />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white border border-gray-300 rounded-md p-6 shadow-sm"
        >
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
            {formData._id ? "Edit FAQ" : "Answer Question"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Question</label>
              <input
                type="text"
                value={formData.question}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Asked By</label>
              <input
                type="text"
                value={formData.askedBy}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Answer</label>
              <textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="4"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700 w-full"
            >
              {formData._id ? "Update Answer" : "Submit Answer"}
            </button>
          </form>
        </motion.div>

        {/* Pending + Answered */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white border border-gray-300 rounded-md p-6 shadow-sm"
        >
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Pending Questions</h3>
          <div className="space-y-4 mb-8">
            {pendingQuestions.length === 0 ? (
              <p className="text-gray-500 font-outfit">No pending questions.</p>
            ) : (
              pendingQuestions.map((q) => (
                <div
                  key={q._id}
                  className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)] transition-all"
                >
                  <h4 className="font-playfair text-base font-semibold text-gray-800">{q.question}</h4>
                  <p className="text-gray-600 font-outfit text-sm">
                    Asked by: <strong>{q.askedBy}</strong> • {formatDate(q.askedAt)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleAnswer(q)}
                      className="text-[var(--color-primary)] hover:underline font-outfit text-sm"
                    >
                      Answer
                    </button>
                    <button
                      onClick={() => handleDeletePending(q._id)}
                      className="text-red-500 hover:underline font-outfit text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Answered FAQs</h3>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div
                key={f._id}
                className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)] transition-all"
              >
                <h4 className="font-playfair text-base font-semibold text-gray-800">{f.question}</h4>
                <p className="text-gray-600 font-outfit mt-1">{f.answer}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Asked by: {f.askedBy} • Answered: {formatDate(f.answeredAt)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleEdit(f)}
                    className="text-[var(--color-primary)] hover:underline font-outfit text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(f._id)}
                    className="text-red-500 hover:underline font-outfit text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ManageFAQs;