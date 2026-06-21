// client/src/components/member/FAQSection.jsx
//
// CHANGES:
//   - fetchMemberPending: NEW — fetches the member's own pending questions
//     from GET /api/faqs/pending/me on mount. Fixes the refresh-loss bug
//     where pending questions only existed in local state and vanished
//     on page reload.
//   - submittedQuestions renamed to pendingQuestions for clarity — it now
//     represents server state, not just this-session submissions.
//   - handleDeletePending: now calls DELETE /api/faqs/pending/me/:id
//     (soft-delete on server) instead of only removing from local state.
//     This means cancelling a pending question is persistent across refreshes.
//   - getMemberFAQs: now calls GET /api/faqs/me instead of GET /api/faqs
//     so members only see their own answered FAQs, not all FAQs.
//   - deleteMemberFAQ: unchanged in behaviour — still calls
//     DELETE /api/faqs/member/:id (now soft-delete on server).
//   - All i18n, accordion, skeleton, toast — unchanged.

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  MessageCircle, Send, Trash2, ChevronDown,
  ChevronUp, Loader2, Clock, CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";
import { formatDate }    from "../../utils/formatDate";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const FAQSkeleton = () => (
  <div className="space-y-3">
    {[1, 2].map(i => (
      <div key={i} className="p-4 rounded-xl border border-gray-100">
        <div className="h-3.5 bg-gray-100 animate-pulse rounded-lg w-3/4 mb-2" />
        <div className="h-3   bg-gray-100 animate-pulse rounded-lg w-full"    />
        <div className="h-3   bg-gray-100 animate-pulse rounded-lg w-2/3 mt-1.5" />
      </div>
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function FAQSection() {
  const { axios, getToken } = useAppContext();
  const { t } = useTranslation("faqs");

  const [answeredFAQs,    setAnsweredFAQs]    = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [question,         setQuestion]         = useState("");
  const [loadingFAQs,      setLoadingFAQs]      = useState(true);
  const [loadingPending,   setLoadingPending]   = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [deletingId,       setDeletingId]       = useState(null);
  const [deletingPendingId, setDeletingPendingId] = useState(null);
  const [expandedFAQ,      setExpandedFAQ]      = useState(null);
  const [charCount,        setCharCount]        = useState(0);

  const MAX_CHARS = 500;

  // ── Fetch member's answered FAQs ─────────────────────────────────────────
  // Uses /api/faqs/me — returns only this member's FAQs where
  // deletedByMember:false and deletedByAdmin:false

  const fetchAnsweredFAQs = useCallback(async () => {
    setLoadingFAQs(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/faqs/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setAnsweredFAQs(data.faqs ?? []);
    } catch {
      // Silent
    } finally {
      setLoadingFAQs(false);
    }
  }, [axios, getToken]);

  // ── Fetch member's pending questions ─────────────────────────────────────
  // FIX: This fetch replaces local-state-only approach.
  // Pending questions now persist across refreshes because they are
  // stored in DB and retrieved here on every mount.

  const fetchPendingQuestions = useCallback(async () => {
    setLoadingPending(true);
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/faqs/pending/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setPendingQuestions(data.pending ?? []);
    } catch {
      // Silent
    } finally {
      setLoadingPending(false);
    }
  }, [axios, getToken]);

  useEffect(() => {
    fetchAnsweredFAQs();
    fetchPendingQuestions();
  }, [fetchAnsweredFAQs, fetchPendingQuestions]);

  // ── Submit question ───────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHARS) {
      toast.error(t("ask.toast.tooLong", { max: MAX_CHARS }));
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(
        "/api/faqs/pending",
        { question: trimmed },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        // Prepend to local state immediately for instant feedback,
        // then the next mount/refresh will load it from DB correctly.
        setPendingQuestions(prev => [data.pending, ...prev]);
        setQuestion("");
        setCharCount(0);
        toast.success(t("ask.toast.submitted"));
      } else {
        toast.error(data.message || "Could not submit question");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete pending question ───────────────────────────────────────────────
  // FIX: Now calls server soft-delete instead of only removing from local state.
  // Member withdrawing a question is persisted — refreshing the page will
  // not bring it back.

  const handleDeletePending = async (pendingId) => {
    if (!window.confirm(t("pending.confirmRemove"))) return;
    setDeletingPendingId(pendingId);
    try {
      const token = await getToken();
      const { data } = await axios.delete(
        `/api/faqs/pending/me/${pendingId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        setPendingQuestions(prev => prev.filter(q => q._id !== pendingId));
        toast.success(t("pending.toast"));
      } else {
        toast.error(data.message || "Could not remove question");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setDeletingPendingId(null);
    }
  };

  // ── Delete answered FAQ from member view ─────────────────────────────────
  // Soft-delete — admin view is completely unaffected

  const handleDeleteAnswered = async (faqId) => {
    if (!window.confirm(t("answered.confirmRemove"))) return;
    setDeletingId(faqId);
    try {
      const token = await getToken();
      const { data } = await axios.delete(`/api/faqs/member/${faqId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setAnsweredFAQs(prev => prev.filter(f => f._id !== faqId));
        toast.success(t("answered.toast"));
      } else {
        toast.error(data.message || "Could not remove FAQ");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  };

  const isLoading = loadingFAQs || loadingPending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.3  }}
      className="space-y-6"
    >
      {/* ── Submit question ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-xl">
            <MessageCircle className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {t("ask.title")}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("ask.subtitle")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setCharCount(e.target.value.length);
              }}
              placeholder={t("ask.placeholder")}
              rows={4}
              maxLength={MAX_CHARS}
              required
              className="w-full px-4 py-3 text-sm text-gray-800
                bg-white border border-gray-200 rounded-xl resize-none
                outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
                focus:border-[var(--color-primary)]
                placeholder:text-gray-300 transition-colors"
            />
            <span className={`absolute bottom-3 right-3 text-[10px] font-medium ${
              charCount > MAX_CHARS * 0.9 ? "text-red-400" : "text-gray-300"
            }`}>
              {t("ask.charCount", { current: charCount, max: MAX_CHARS })}
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !question.trim()}
              className="flex items-center gap-2 px-5 py-2.5
                bg-[var(--color-primary)] hover:bg-blue-700
                disabled:opacity-40 disabled:cursor-not-allowed
                text-white text-sm font-semibold rounded-xl
                shadow-sm transition-all duration-150 active:scale-95"
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("ask.submitting")}</>
                : <><Send    className="h-4 w-4" /> {t("ask.submit")}</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* ── Pending questions ──────────────────────────────────────── */}
      <AnimatePresence>
        {(loadingPending || pendingQuestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{    opacity: 0, height: 0    }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-amber-700">
                {t("pending.label", { count: pendingQuestions.length })}
              </p>
            </div>

            {loadingPending ? (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 bg-amber-50 border
                    border-amber-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {pendingQuestions.map((q) => (
                  <motion.div
                    key={q._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{    opacity: 0, y: -4 }}
                    className="flex items-start justify-between gap-3
                      p-4 bg-amber-50 border border-amber-100 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {q.question}
                      </p>
                      <p className="text-[11px] text-amber-600 mt-1.5">
                        {t("pending.submitted", {
                          date: formatDate(q.askedAt ?? q.createdAt),
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePending(q._id)}
                      disabled={deletingPendingId === q._id}
                      title={t("pending.removeTitle")}
                      className="p-1.5 rounded-lg text-gray-300
                        hover:text-red-400 hover:bg-red-50 transition-colors
                        flex-shrink-0 disabled:opacity-40"
                    >
                      {deletingPendingId === q._id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2  className="h-3.5 w-3.5" />
                      }
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Divider ────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100" />

      {/* ── Answered FAQs ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-semibold text-gray-900">
            {t("answered.title")}
          </p>
          {answeredFAQs.length > 0 && (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600
              text-[10px] font-semibold rounded-full">
              {answeredFAQs.length}
            </span>
          )}
        </div>

        {loadingFAQs ? (
          <FAQSkeleton />
        ) : answeredFAQs.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="space-y-2">
            {answeredFAQs.map((faq, index) => (
              <FAQItem
                key={faq._id}
                faq={faq}
                index={index}
                isExpanded={expandedFAQ === faq._id}
                onToggle={() =>
                  setExpandedFAQ(expandedFAQ === faq._id ? null : faq._id)
                }
                onDelete={() => handleDeleteAnswered(faq._id)}
                deleting={deletingId === faq._id}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── FAQItem ──────────────────────────────────────────────────────────────────

function FAQItem({ faq, index, isExpanded, onToggle, onDelete, deleting, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={`border rounded-xl overflow-hidden transition-colors ${
        isExpanded
          ? "border-[var(--color-primary)]/30 bg-blue-50/20"
          : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3
          px-4 py-3.5 text-left"
      >
        <p className={`text-sm font-medium leading-relaxed flex-1 ${
          isExpanded ? "text-[var(--color-primary)]" : "text-gray-800"
        }`}>
          {faq.question}
        </p>
        {isExpanded
          ? <ChevronUp   className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
        }
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{    height: 0,    opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100/70">
              <p className="text-sm text-gray-600 leading-relaxed pt-3">
                {faq.answer}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-gray-400">
                  {t("answered.answered", {
                    date: formatDate(faq.answeredAt),
                  })}
                </p>
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  title={t("answered.removeTitle")}
                  className="flex items-center gap-1.5 text-[11px] font-medium
                    text-gray-400 hover:text-red-500 transition-colors
                    disabled:opacity-40"
                >
                  {deleting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2  className="h-3 w-3" />
                  }
                  {t("answered.remove")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ t }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center
        justify-center mb-3">
        <MessageCircle className="h-5 w-5 text-gray-300" />
      </div>
      <p className="text-sm text-gray-400">{t("answered.empty.title")}</p>
      <p className="text-xs text-gray-300 mt-1">{t("answered.empty.subtitle")}</p>
    </div>
  );
}