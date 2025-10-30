// controllers/faqController.js
import FAQ from "../models/FAQ.js";
import PendingQuestion from "../models/PendingQuestion.js";
import Notification from "../models/Notification.js";

export const submitPending = async (req, res) => {
  try {
    const { question } = req.body;
    const clerkUserId = req.clerkUserId;
    if (!question?.trim()) {
      return res.status(400).json({ success: false, message: "Question is required" });
    }
    const askedBy = req.member?.name || "Member";
    const pending = await PendingQuestion.create({
      question: question.trim(),
      clerkUserId,
      askedBy,
    });
    await Notification.create({
      type: "Question",
      content: `New question from ${askedBy}: "${question.trim()}"`,
      adminOnly: true,
    });
    return res.status(201).json({ success: true, pending });
  } catch (error) {
    console.error("submitPending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPending = async (req, res) => {
  try {
    const pending = await PendingQuestion.find().sort({ askedAt: -1 });
    return res.status(200).json({ success: true, pending });
  } catch (error) {
    console.error("getPending error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const answerFAQ = async (req, res) => {
  try {
    const { question, answer, askedBy, clerkUserId } = req.body;
    const faq = await FAQ.create({
      question,
      answer,
      askedBy,
      clerkUserId,
      answeredAt: new Date(),
    });
    await PendingQuestion.deleteOne({ question });
    // Notify member
    await Notification.create({
      type: "FAQ",
      content: `Your question has been answered: "${question}"`,
      clerkUserId,
      adminOnly: false,
    });
    // Notify admin
    await Notification.create({
      type: "FAQ",
      content: `FAQ answered: "${question}"`,
      adminOnly: true,
    });
    return res.status(201).json({ success: true, faq });
  } catch (error) {
    console.error("answerFAQ error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ answeredAt: -1 });
    return res.status(200).json({ success: true, faqs });
  } catch (error) {
    console.error("getFAQs error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateFAQ = async (req, res) => {
  try {
    const { answer } = req.body;
    const faq = await FAQ.findByIdAndUpdate(
      req.params.id,
      { answer, answeredAt: new Date() },
      { new: true }
    );
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    // Notify member
    await Notification.create({
      type: "FAQ",
      content: `Your FAQ was updated: "${faq.question}"`,
      clerkUserId: faq.clerkUserId,
      adminOnly: false,
    });
    res.json({ success: true, faq });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ADMIN DELETE: No member notification, no delete from member dashboard
export const deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    await FAQ.findByIdAndDelete(req.params.id);
    // NO NOTIFICATION TO MEMBER
    res.json({ success: true, message: "FAQ deleted from admin panel" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ADMIN DELETE PENDING: No member notification
export const deletePending = async (req, res) => {
  try {
    const question = await PendingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ success: false, message: "Question not found" });
    await PendingQuestion.findByIdAndDelete(req.params.id);
    // NO NOTIFICATION TO MEMBER
    res.json({ success: true, message: "Pending question deleted from admin panel" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// MEMBER DELETE: Only their own
export const deleteMemberFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findOne({ _id: id, clerkUserId: req.clerkUserId });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found or not yours" });
    await FAQ.findByIdAndDelete(id);
    res.json({ success: true, message: "Your FAQ deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};