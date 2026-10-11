// server/controllers/notificationController.js
//
// CHANGE (this pass): members get PER-USER read state. `readBy` holds the
// reader's Clerk id, so a broadcast read by one member stays unread for
// everyone else. Notifications are never deleted by reading.
// The admin activity feed handlers are unchanged.

import Notification from "../models/Notification.js";

// Admin dashboard activity feed
export const getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ adminOnly: true })
      .sort({ createdAt: -1 })
      .limit(15);

    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error(`getAdminNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Clear all admin notifications
export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ adminOnly: true });
    return res.status(200).json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    console.error(`deleteAllNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// A notification is visible to a member if it is personal to them or a broadcast.
const visibleTo = (clerkUserId) => ({
  $or: [{ clerkUserId }, { adminOnly: false, clerkUserId: null }],
});

// Member notifications: latest 20 with isRead (the readBy list is never returned).
export const getMemberNotifications = async (req, res) => {
  try {
    const { clerkUserId } = req;

    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const notifications = await Notification.aggregate([
      { $match: visibleTo(clerkUserId) },
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      {
        $project: {
          type: 1,
          content: 1,
          createdAt: 1,
          isRead: { $in: [clerkUserId, { $ifNull: ["$readBy", []] }] },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (error) {
    console.error(`getMemberNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { clerkUserId } = req;

    const result = await Notification.updateOne(
      { _id: req.params.id, ...visibleTo(clerkUserId) },
      { $addToSet: { readBy: clerkUserId } },
      { timestamps: false },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`markNotificationRead error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const { clerkUserId } = req;

    const result = await Notification.updateMany(
      { ...visibleTo(clerkUserId), readBy: { $ne: clerkUserId } },
      { $addToSet: { readBy: clerkUserId } },
      { timestamps: false },
    );

    return res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error(`markAllNotificationsRead error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};