// controllers/noticeController.js
import Notice from "../models/Notice.js";
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";
import { v2 as cloudinary } from "cloudinary";
import { sendNoticeEmail } from "../utils/sendNoticeEmail.js"; // NEW

export const createNotice = async (req, res) => {
  try {
    const { title, date, summary, content } = req.body;
    const createdBy = req.auth.userId;

    if (!title || !date || !summary || !content) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    let image = "";
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path);
      image = uploadResult.secure_url;
    }

    const notice = await Notice.create({
      title,
      date,
      summary,
      content,
      image,
      createdBy,
    });

    // Create in-app notification (for all members)
    await Notification.create({
      type: "Notice",
      content: `New notice posted: ${title}`,
      adminOnly: false, // Show to all
    });

    // === SEND EMAIL TO ALL MEMBERS (ASYNC – NON-BLOCKING) ===
    const members = await Member.find({}).select("email name");
    members.forEach(async (member) => {
      if (member.email) {
        await sendNoticeEmail(member.email, notice);
      }
    });

    res.status(201).json({
      success: true,
      message: "Notice created and emails sent successfully",
      notice,
    });
  } catch (error) {
    console.error(`createNotice error: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, notices });
  } catch (error) {
    console.error(`getNotices error: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }
    res.status(200).json({ success: true, notice });
  } catch (error) {
    console.error(`getNoticeById error: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateNotice = async (req, res) => {
  try {
    const { title, date, summary, content } = req.body;
    const createdBy = req.auth.userId;

    if (!title || !date || !summary || !content) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    let image = notice.image;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path);
      image = uploadResult.secure_url;
    }

    const updatedNotice = await Notice.findByIdAndUpdate(
      req.params.id,
      { title, date, summary, content, image, createdBy },
      { new: true }
    );

    res.status(200).json({ success: true, message: "Notice updated successfully", notice: updatedNotice });
  } catch (error) {
    console.error(`updateNotice error: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    await Notice.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Notice deleted successfully" });
  } catch (error) {
    console.error(`deleteNotice error: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};         