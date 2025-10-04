import Notice from "../models/Notice.js";
import Notification from "../models/Notification.js";
import Member from "../models/Member.js";

export const getNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ date: -1 }).limit(10);
    res.json({ success: true, notices });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to fetch notices" });
  }
};

export const createNotice = async (req, res) => {
  try {
    const notice = await Notice.create(req.body);

    // Notify all members
    const members = await Member.find();
    const notifications = members.map((member) => ({
      memberId: member.clerkUserId,
      message: `New notice posted: ${notice.title}`,
      date: new Date(),
    }));
    await Notification.insertMany(notifications);

    res.json({ success: true, message: "Notice created successfully", notice });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to create notice" });
  }
};