import Question from "../models/Question.js";
import Notification from "../models/Notification.js";

export const submitQuestion = async (req, res) => {
  try {
    const question = await Question.create({
      ...req.body,
      memberId: req.member.clerkUserId,
    });
    res.json({ success: true, message: "Question submitted successfully", question });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to submit question" });
  }
};

export const getUserQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ memberId: req.member.clerkUserId }).sort({ askedAt: -1 });
    res.json({ success: true, questions });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to fetch questions" });
  }
};

export const answerQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { answered: true, answer: req.body.answer },
      { new: true }
    );
    if (!question) {
      return res.json({ success: false, message: "Question not found" });
    }

    // Notify member
    await Notification.create({
      memberId: question.memberId,
      message: `Your question "${question.question}" has been answered by admin.`,
      date: new Date(),
    });

    res.json({ success: true, message: "Question answered successfully", question });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to answer question" });
  }
};