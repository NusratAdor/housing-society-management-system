// controllers/eventController.js
//
// Mirrors committeeController.js's structure (image upload/cleanup via
// cloudinaryService) and announcementController.js's conventions
// (try/catch, {success, message} shape).
//
// Public/admin split, deliberately: getPublicEvents only ever returns
// isPublished:true events — an unpublished (draft) event must never be
// reachable through the public endpoint, even by guessing its ID.
// getEvents (admin, gated below) returns everything, published or not,
// so the admin panel can manage drafts.

import Event from "../models/Event.js";
import { uploadImage, deleteImage } from "../services/cloudinaryService.js";

// ─── GET (public) — published events only ──────────────────────────────────

export const getPublicEvents = async (req, res) => {
  try {
    const events = await Event.find({ isPublished: true }).sort({ eventDate: -1 });
    return res.json({ success: true, events });
  } catch (error) {
    console.error("getPublicEvents error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET single (public) ───────────────────────────────────────────────────

export const getPublicEventById = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, isPublished: true });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    return res.json({ success: true, event });
  } catch (error) {
    console.error("getPublicEventById error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET (admin) — full list, including unpublished ────────────────────────

export const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ eventDate: -1 });
    return res.json({ success: true, events });
  } catch (error) {
    console.error("getEvents error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── CREATE ──────────────────────────────────────────────────────────────

export const createEvent = async (req, res) => {
  try {
    const { title, excerpt, description, location, eventDate, isPublished } = req.body;

    if (!title?.trim() || !description?.trim() || !eventDate) {
      return res.status(400).json({
        success: false,
        message: "Title, description and event date are required",
      });
    }

    let image = "", imagePublicId = "";
    if (req.file) {
      const uploaded = await uploadImage(req.file, "housing-system/events");
      image = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const event = await Event.create({
      title: title.trim(),
      excerpt: excerpt?.trim() || "",
      description: description.trim(),
      location: location?.trim() || "",
      eventDate,
      image,
      imagePublicId,
      isPublished: isPublished === undefined ? true : isPublished === "true" || isPublished === true,
      createdBy: req.clerkUserId,
    });

    return res.status(201).json({ success: true, event });
  } catch (error) {
    console.error("createEvent error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────

export const updateEvent = async (req, res) => {
  try {
    const existing = await Event.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const { title, excerpt, description, location, eventDate, isPublished } = req.body;

    if (title !== undefined)       existing.title = title.trim();
    if (excerpt !== undefined)     existing.excerpt = excerpt.trim();
    if (description !== undefined) existing.description = description.trim();
    if (location !== undefined)    existing.location = location.trim();
    if (eventDate !== undefined)   existing.eventDate = eventDate;
    if (isPublished !== undefined) existing.isPublished = isPublished === "true" || isPublished === true;

    if (req.file) {
      if (existing.imagePublicId) await deleteImage(existing.imagePublicId);
      const uploaded = await uploadImage(req.file, "housing-system/events");
      existing.image = uploaded.secure_url;
      existing.imagePublicId = uploaded.public_id;
    }

    await existing.save();
    return res.json({ success: true, event: existing });
  } catch (error) {
    console.error("updateEvent error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (event.imagePublicId) await deleteImage(event.imagePublicId);
    await Event.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: "Event deleted" });
  } catch (error) {
    console.error("deleteEvent error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};