// controllers/announcementController.js
//
// Mirrors committeeController.js's structure/conventions closely —
// same try/catch + {success, message} shape. The one addition is
// getActiveAnnouncement, which resolves "which single announcement
// should the homepage show right now" server-side: isActive, within
// its optional date window, highest priority first, most recent as
// the tie-breaker. The frontend never has to filter or compare dates —
// it just renders whatever this endpoint returns (or nothing).

import Announcement from "../models/Announcement.js";

// ─── GET (admin) — full list, newest first ─────────────────────────────────

export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    return res.json({ success: true, announcements });
  } catch (error) {
    console.error("getAnnouncements error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET (public) — the single announcement the homepage should show ──────

export const getActiveAnnouncement = async (req, res) => {
  try {
    const now = new Date();

    const candidates = await Announcement.find({
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(1);

    return res.json({ success: true, announcement: candidates[0] || null });
  } catch (error) {
    console.error("getActiveAnnouncement error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── CREATE ──────────────────────────────────────────────────────────────

export const createAnnouncement = async (req, res) => {
  try {
    const { text, link, type, isActive, startDate, endDate, priority } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: "Announcement text is required" });
    }

    const announcement = await Announcement.create({
      text: text.trim(),
      link: link?.trim() || "",
      type: type || "info",
      isActive: isActive === undefined ? true : Boolean(isActive),
      startDate: startDate || null,
      endDate: endDate || null,
      priority: Number(priority) || 0,
      createdBy: req.clerkUserId,
    });

    return res.status(201).json({ success: true, announcement });
  } catch (error) {
    console.error("createAnnouncement error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────

export const updateAnnouncement = async (req, res) => {
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Announcement not found" });
    }

    const { text, link, type, isActive, startDate, endDate, priority } = req.body;

    if (text !== undefined)      existing.text = text.trim();
    if (link !== undefined)      existing.link = link.trim();
    if (type !== undefined)      existing.type = type;
    if (isActive !== undefined)  existing.isActive = Boolean(isActive);
    if (startDate !== undefined) existing.startDate = startDate || null;
    if (endDate !== undefined)   existing.endDate = endDate || null;
    if (priority !== undefined)  existing.priority = Number(priority) || 0;

    await existing.save();
    return res.json({ success: true, announcement: existing });
  } catch (error) {
    console.error("updateAnnouncement error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────

export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: "Announcement not found" });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Announcement deleted" });
  } catch (error) {
    console.error("deleteAnnouncement error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};