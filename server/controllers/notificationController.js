// controllers/notificationController.js
import Notification from "../models/Notification.js";

/**
 * Get recent admin-only notifications (for admin dashboard)
 */
export const getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ adminOnly: true })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      notifications,
      message: notifications.length ? undefined : "No notifications found",
    });
  } catch (error) {
    console.error(`getAdminNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Delete all admin-only notifications
 */
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

/**
 * Get notifications for the authenticated member
 * Includes:
 *  - Personal notifications (clerkUserId matches)
 *  - Broadcast messages (adminOnly: false, clerkUserId: null)
 */
export const getMemberNotifications = async (req, res) => {
  try {
    const { clerkUserId } = req;

    if (!clerkUserId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const notifications = await Notification.find({
      $or: [
        { clerkUserId },                            // Personal
        { adminOnly: false, clerkUserId: null }     // Broadcast
      ]
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      notifications,
      message: notifications.length ? undefined : "No notifications found",
    });
  } catch (error) {
    console.error(`getMemberNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};