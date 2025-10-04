import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ memberId: req.member.clerkUserId })
      .sort({ date: -1 })
      .limit(10);
    res.json({ success: true, notifications });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to fetch notifications" });
  }
};

export const createNotification = async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.json({ success: true, message: "Notification created successfully", notification });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to create notification" });
  }
};