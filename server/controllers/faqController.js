// server/controllers/faqController.js
//
// CHANGES:
//   - getPublicFAQs:    NEW — returns only isPublic:true, deletedByAdmin:false.
//                       Used by home page FAQSection. No auth required.
//   - getFAQs:          Admin view — returns all non-deletedByAdmin FAQs.
//                       Member view — returns FAQs where clerkUserId matches
//                       AND deletedByMember:false AND deletedByAdmin:false.
//   - getMemberPending: NEW — returns the calling member's pending questions
//                       where deletedByMember:false. Fixes refresh-loss bug.
//   - deleteMemberFAQ:  Soft-delete only. Sets deletedByMember:true.
//                       Admin view unaffected.
//   - deleteMemberPending: NEW — member cancels their own pending question
//                       before admin answers. Sets deletedByMember:true.
//   - deleteFAQ:        Admin soft-delete. Sets deletedByAdmin:true.
//                       Member view filters these out automatically.
//   - togglePublic:     NEW — admin flips isPublic on any answered FAQ.
//                       This is the gate between private Q&A and public FAQ.
//   - answerFAQ:        Now deletes PendingQuestion by _id (not by question
//                       text match which was fragile for duplicate questions).
//   - All other handlers (submitPending, getPending, updateFAQ,
//     deletePending) unchanged except deletePending which hard-deletes
//     (admin discarding a pending question is fine to hard-delete).

import FAQ             from "../models/FAQ.js";
import PendingQuestion from "../models/PendingQuestion.js";
import Notification    from "../models/Notification.js";

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// Home page FAQ section — only explicitly promoted FAQs
export const getPublicFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({
      isPublic:        true,
      deletedByAdmin:  false,
    })
      .sort({ answeredAt: -1 })
      .limit(10)
      .select("question answer askedBy answeredAt");

    return res.status(200).json({ success: true, faqs });
  } catch (error) {
    console.error("getPublicFAQs error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── MEMBER ───────────────────────────────────────────────────────────────────

// Member's own answered FAQs — excludes deleted by either party
export const getMemberFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({
      clerkUserId:     req.clerkUserId,
      deletedByMember: false,
      deletedByAdmin:  false,
    }).sort({ answeredAt: -1 });

    return res.status(200).json({ success: true, faqs });
  } catch (error) {
    console.error("getMemberFAQs error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Member's own pending questions — fixes the refresh-loss bug.
// Previously pending questions only lived in local React state.
// Now they are fetched from DB on every mount.
export const getMemberPending = async (req, res) => {
  try {
    const pending = await PendingQuestion.find({
      clerkUserId:     req.clerkUserId,
      deletedByMember: false,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, pending });
  } catch (error) {
    console.error("getMemberPending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Submit a new pending question
export const submitPending = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Question is required" });
    }

    const askedBy = req.member?.name || "Member";
    const pending = await PendingQuestion.create({
      question:    question.trim(),
      clerkUserId: req.clerkUserId,
      askedBy,
    });

    await Notification.create({
      type:      "Question",
      content:   `New question from ${askedBy}: "${question.trim()}"`,
      adminOnly: true,
    });

    return res.status(201).json({ success: true, pending });
  } catch (error) {
    console.error("submitPending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Member soft-deletes their own pending question before admin answers
export const deleteMemberPending = async (req, res) => {
  try {
    const pending = await PendingQuestion.findOne({
      _id:         req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!pending) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found or not yours" });
    }

    // Soft-delete — admin can still see it was submitted and withdrawn
    pending.deletedByMember = true;
    await pending.save();

    return res.json({ success: true, message: "Question withdrawn" });
  } catch (error) {
    console.error("deleteMemberPending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Member soft-deletes an answered FAQ from their view
// Admin view is completely unaffected
export const deleteMemberFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findOne({
      _id:         req.params.id,
      clerkUserId: req.clerkUserId,
    });

    if (!faq) {
      return res
        .status(404)
        .json({ success: false, message: "FAQ not found or not yours" });
    }

    faq.deletedByMember = true;
    await faq.save();

    return res.json({ success: true, message: "Removed from your view" });
  } catch (error) {
    console.error("deleteMemberFAQ error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// Admin sees all non-deleted FAQs regardless of member soft-delete
export const getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({
      deletedByAdmin: false,
    }).sort({ answeredAt: -1 });

    return res.status(200).json({ success: true, faqs });
  } catch (error) {
    console.error("getFAQs error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin sees all pending questions not yet soft-deleted by member
// (withdrawn questions filtered out by default, admin can add ?all=true
//  to see them if needed in future — extensible without breaking changes)
export const getPending = async (req, res) => {
  try {
    const filter = req.query.all === "true"
      ? {}
      : { deletedByMember: false };

    const pending = await PendingQuestion
      .find(filter)
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, pending });
  } catch (error) {
    console.error("getPending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Answer a pending question — creates FAQ, removes pending record
export const answerFAQ = async (req, res) => {
  try {
    const { question, answer, askedBy, clerkUserId, pendingId } = req.body;

    if (!question?.trim() || !answer?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Question and answer are required" });
    }

    const faq = await FAQ.create({
      question:    question.trim(),
      answer:      answer.trim(),
      askedBy:     askedBy || "Member",
      clerkUserId: clerkUserId || null,
      answeredAt:  new Date(),
      // isPublic defaults false — admin must explicitly promote it
    });

    // Delete the pending question by _id (more reliable than by question text)
    if (pendingId) {
      await PendingQuestion.findByIdAndDelete(pendingId);
    } else {
      // Fallback for answers created from scratch (no pending source)
      await PendingQuestion.deleteOne({ question: question.trim(), clerkUserId });
    }

    // Notify the member who asked (only if from a real member question)
    if (clerkUserId) {
      await Notification.create({
        type:        "FAQ",
        content:     `Your question has been answered: "${question.trim()}"`,
        clerkUserId,
        adminOnly:   false,
      });
    }

    await Notification.create({
      type:      "FAQ",
      content:   `FAQ answered: "${question.trim()}"`,
      adminOnly: true,
    });

    return res.status(201).json({ success: true, faq });
  } catch (error) {
    console.error("answerFAQ error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin updates answer text
export const updateFAQ = async (req, res) => {
  try {
    const { answer } = req.body;

    if (!answer?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Answer is required" });
    }

    const faq = await FAQ.findByIdAndUpdate(
      req.params.id,
      { answer: answer.trim(), answeredAt: new Date() },
      { new: true }
    );

    if (!faq) {
      return res
        .status(404)
        .json({ success: false, message: "FAQ not found" });
    }

    if (faq.clerkUserId) {
      await Notification.create({
        type:        "FAQ",
        content:     `Your FAQ was updated: "${faq.question}"`,
        clerkUserId: faq.clerkUserId,
        adminOnly:   false,
      });
    }

    return res.json({ success: true, faq });
  } catch (error) {
    console.error("updateFAQ error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin soft-deletes FAQ — member view filters deletedByAdmin:true
// No notification to member (intentional — admin housekeeping action)
export const deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);

    if (!faq) {
      return res
        .status(404)
        .json({ success: false, message: "FAQ not found" });
    }

    faq.deletedByAdmin = true;
    // Also retract public visibility when admin deletes
    faq.isPublic = false;
    await faq.save();

    return res.json({ success: true, message: "FAQ removed" });
  } catch (error) {
    console.error("deleteFAQ error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin hard-deletes a pending question (discarding it entirely)
export const deletePending = async (req, res) => {
  try {
    const question = await PendingQuestion.findById(req.params.id);

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    await PendingQuestion.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: "Pending question removed" });
  } catch (error) {
    console.error("deletePending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin toggles isPublic — the gate between private Q&A and public home FAQ
export const togglePublic = async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);

    if (!faq) {
      return res
        .status(404)
        .json({ success: false, message: "FAQ not found" });
    }

    if (faq.deletedByAdmin) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot promote a deleted FAQ" });
    }

    faq.isPublic = !faq.isPublic;
    await faq.save();

    return res.json({
      success:  true,
      faq,
      message: faq.isPublic
        ? "FAQ is now public on home page"
        : "FAQ removed from home page",
    });
  } catch (error) {
    console.error("togglePublic error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};