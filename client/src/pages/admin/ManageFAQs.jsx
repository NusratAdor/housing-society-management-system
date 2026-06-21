// client/src/pages/admin/ManageFAQs.jsx
//
// CHANGES:
//   - Toggle Public button added to each answered FAQ card.
//     Globe icon = currently public (click to unpublish).
//     GlobeLock icon = currently private (click to publish to home page).
//     Visual badge "Public" shown on promoted FAQs so admin knows at a glance.
//   - handleTogglePublic: calls PATCH /api/faqs/:id/toggle-public.
//     Updates local state immediately on success.
//   - Admin delete is now soft-delete (server sets deletedByAdmin:true).
//     The FAQ disappears from admin list immediately via local state filter —
//     this is correct because the admin chose to remove it.
//   - answerFAQ now sends pendingId in the request body so the controller
//     can delete pending by _id (more reliable than by question text).
//   - All existing functionality (answer, edit, delete pending) unchanged.

import React, { useState, useEffect, useCallback } from "react";
import Title     from "../../components/Title";
import { motion } from "framer-motion";
import { toast }  from "react-hot-toast";
import { Globe, GlobeLock, Trash2, Edit2 } from "lucide-react";
import { formatDate }    from "../../utils/formatDate";
import { useAppContext } from "../../context/AppContext";
import usePageTitle      from "../../hooks/usePageTitle";

const ManageFAQs = () => {
  const { axios, getToken } = useAppContext();
  usePageTitle("Manage FAQs");

  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [faqs,             setFaqs]             = useState([]);
  const [formData,         setFormData]         = useState({
    _id:         null,
    pendingId:   null,   // NEW — tracks which pending record to delete on answer
    question:    "",
    answer:      "",
    askedBy:     "",
    clerkUserId: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken();
      const [pRes, fRes] = await Promise.all([
        axios.get("/api/faqs/pending", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/faqs", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setPendingQuestions(pRes.data.pending || []);
      setFaqs(fRes.data.faqs || []);
    } catch {
      toast.error("Failed to load FAQs");
    }
  }, [axios, getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load a pending question into the answer form
  const handleAnswer = (q) => {
    setFormData({
      _id:         null,
      pendingId:   q._id,   // pass the pending record's _id
      question:    q.question,
      answer:      "",
      askedBy:     q.askedBy || "Member",
      clerkUserId: q.clerkUserId,
    });
  };

  // Load an answered FAQ into the edit form
  const handleEdit = (faq) => {
    setFormData({
      _id:         faq._id,
      pendingId:   null,
      question:    faq.question,
      answer:      faq.answer,
      askedBy:     faq.askedBy,
      clerkUserId: faq.clerkUserId,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = await getToken();

      if (formData._id) {
        // Edit existing FAQ
        const { data } = await axios.put(
          `/api/faqs/${formData._id}`,
          { answer: formData.answer },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setFaqs(prev =>
            prev.map(f => f._id === formData._id ? data.faq : f)
          );
          toast.success("FAQ updated");
        }
      } else {
        // Answer a pending question (or create from scratch)
        const { data } = await axios.post(
          "/api/faqs",
          {
            question:    formData.question,
            answer:      formData.answer,
            askedBy:     formData.askedBy,
            clerkUserId: formData.clerkUserId,
            pendingId:   formData.pendingId,   // NEW
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          // Remove from pending list
          if (formData.pendingId) {
            setPendingQuestions(prev =>
              prev.filter(p => p._id !== formData.pendingId)
            );
          }
          setFaqs(prev => [data.faq, ...prev]);
          toast.success("Question answered");
        }
      }

      setFormData({
        _id: null, pendingId: null,
        question: "", answer: "", askedBy: "", clerkUserId: "",
      });
    } catch {
      toast.error("Failed to submit");
    }
  };

  // Admin soft-delete FAQ
  const handleDelete = async (id) => {
    if (!window.confirm("Remove this FAQ? Members will no longer see it.")) return;
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/faqs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setFaqs(prev => prev.filter(f => f._id !== id));
        toast.success("FAQ removed");
      }
    } catch {
      toast.error("Failed to remove FAQ");
    }
  };

  // Admin hard-delete pending question
  const handleDeletePending = async (id) => {
    if (!window.confirm("Discard this pending question?")) return;
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/faqs/pending/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setPendingQuestions(prev => prev.filter(p => p._id !== id));
        toast.success("Question discarded");
      }
    } catch {
      toast.error("Failed to discard question");
    }
  };

  // Admin toggles public visibility — the key new feature
  const handleTogglePublic = async (id, currentlyPublic) => {
    try {
      const token = await getToken();
      const { data } = await axios.patch(
        `/api/faqs/${id}/toggle-public`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setFaqs(prev =>
          prev.map(f => f._id === id ? { ...f, isPublic: data.faq.isPublic } : f)
        );
        toast.success(data.message);
      }
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage FAQs"
        subTitle="Answer member questions. Promote answers to the public home page FAQ."
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Answer / Edit form ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0  }}
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
        >
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-1">
            {formData._id ? "Edit Answer" : "Answer Question"}
          </h3>
          <p className="text-xs text-gray-400 font-outfit mb-5">
            {formData._id
              ? "Update the answer text below."
              : "Fill in the answer, then optionally publish it to the home page."
            }
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Question
              </label>
              <input
                type="text"
                value={formData.question}
                onChange={e =>
                  !formData._id &&
                  setFormData(f => ({ ...f, question: e.target.value }))
                }
                readOnly={!!formData._id}
                placeholder="Type a question or select one from pending"
                className="w-full px-3 py-2 text-sm border border-gray-200
                  rounded-xl bg-gray-50 text-gray-700 outline-none
                  focus:ring-2 focus:ring-[var(--color-primary)]/20
                  focus:border-[var(--color-primary)]"
              />
            </div>

            {formData.askedBy && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Asked by
                </label>
                <input
                  type="text"
                  value={formData.askedBy}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-200
                    rounded-xl bg-gray-50 text-gray-400 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Answer
              </label>
              <textarea
                value={formData.answer}
                onChange={e =>
                  setFormData(f => ({ ...f, answer: e.target.value }))
                }
                rows={5}
                required
                placeholder="Write the answer here…"
                className="w-full px-3 py-2 text-sm border border-gray-200
                  rounded-xl resize-none outline-none
                  focus:ring-2 focus:ring-[var(--color-primary)]/20
                  focus:border-[var(--color-primary)]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[var(--color-primary)] hover:bg-blue-700
                  text-white text-sm font-semibold rounded-xl py-2.5
                  transition-colors"
              >
                {formData._id ? "Update Answer" : "Submit Answer"}
              </button>
              {(formData.question || formData.answer) && (
                <button
                  type="button"
                  onClick={() => setFormData({
                    _id: null, pendingId: null,
                    question: "", answer: "", askedBy: "", clerkUserId: "",
                  })}
                  className="px-4 py-2.5 text-sm text-gray-500 border
                    border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </motion.div>

        {/* ── Pending + Answered lists ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0  }}
          className="lg:col-span-2 space-y-8"
        >
          {/* Pending */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-playfair text-base font-semibold text-gray-800">
                Pending Questions
              </h3>
              {pendingQuestions.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600
                  text-[10px] font-semibold rounded-full">
                  {pendingQuestions.length}
                </span>
              )}
            </div>

            {pendingQuestions.length === 0 ? (
              <p className="text-sm text-gray-400 font-outfit py-4 text-center">
                No pending questions from members.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingQuestions.map(q => (
                  <div
                    key={q._id}
                    className="p-4 border border-gray-100 rounded-xl
                      hover:border-[var(--color-primary)]/40 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      {q.question}
                    </p>
                    <p className="text-xs text-gray-400 font-outfit">
                      Asked by <strong className="text-gray-600">
                        {q.askedBy}
                      </strong> · {formatDate(q.askedAt ?? q.createdAt)}
                    </p>
                    <div className="mt-3 flex gap-3">
                      <button
                        onClick={() => handleAnswer(q)}
                        className="text-xs font-semibold text-[var(--color-primary)]
                          hover:underline font-outfit"
                      >
                        Answer
                      </button>
                      <button
                        onClick={() => handleDeletePending(q._id)}
                        className="text-xs font-semibold text-red-400
                          hover:text-red-600 hover:underline font-outfit"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Answered FAQs */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-playfair text-base font-semibold text-gray-800">
                Answered FAQs
              </h3>
              <span className="text-xs text-gray-400 font-outfit">
                {faqs.filter(f => f.isPublic).length} public ·{" "}
                {faqs.length} total
              </span>
            </div>
            <p className="text-xs text-gray-400 font-outfit mb-4">
              Toggle the globe icon to publish an FAQ to the home page.
            </p>

            {faqs.length === 0 ? (
              <p className="text-sm text-gray-400 font-outfit py-4 text-center">
                No answered FAQs yet.
              </p>
            ) : (
              <div className="space-y-3">
                {faqs.map(f => (
                  <div
                    key={f._id}
                    className={`p-4 border rounded-xl transition-colors ${
                      f.isPublic
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-800 leading-snug">
                            {f.question}
                          </p>
                          {f.isPublic && (
                            <span className="flex-shrink-0 px-1.5 py-0.5
                              bg-emerald-100 text-emerald-700 text-[10px]
                              font-semibold rounded-full">
                              Public
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {f.answer}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1.5 font-outfit">
                          {f.askedBy} · {formatDate(f.answeredAt)}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Toggle public */}
                        <button
                          onClick={() => handleTogglePublic(f._id, f.isPublic)}
                          title={f.isPublic
                            ? "Remove from home page"
                            : "Publish to home page"
                          }
                          className={`p-1.5 rounded-lg transition-colors ${
                            f.isPublic
                              ? "text-emerald-600 hover:bg-emerald-100"
                              : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {f.isPublic
                            ? <Globe     className="h-4 w-4" />
                            : <GlobeLock className="h-4 w-4" />
                          }
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleEdit(f)}
                          title="Edit answer"
                          className="p-1.5 rounded-lg text-gray-300
                            hover:text-[var(--color-primary)]
                            hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(f._id)}
                          title="Remove FAQ"
                          className="p-1.5 rounded-lg text-gray-300
                            hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ManageFAQs;