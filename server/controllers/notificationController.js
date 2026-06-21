// server/controllers/notificationController.js
//
// CHANGE: getAdminNotifications limit raised from 5 → 15.
// 5 was too few — admin activity feed needs enough context to be useful.
// 15 matches the professional standard for dashboard activity feeds
// (Vercel, Linear, Stripe all show ~10-15 recent events).
// All other handlers unchanged.

import Notification from "../models/Notification.js";

// Admin dashboard activity feed
export const getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ adminOnly: true })
      .sort({ createdAt: -1 })
      .limit(15);                    // was 5

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error(`getAdminNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Clear all admin notifications
export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ adminOnly: true });
    return res.status(200).json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error(`deleteAllNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Member notifications
export const getMemberNotifications = async (req, res) => {
  try {
    const { clerkUserId } = req;

    if (!clerkUserId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const notifications = await Notification.find({
      $or: [
        { clerkUserId },
        { adminOnly: false, clerkUserId: null },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error(`getMemberNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};