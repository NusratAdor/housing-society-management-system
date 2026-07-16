// controllers/committeeController.js
//
// Mirrors galleryController.js's structure/conventions closely —
// same uploadImage/deleteImage service, same error-handling pattern.

import CommitteeMember from "../models/CommitteeMember.js";
import { uploadImage, deleteImage } from "../services/cloudinaryService.js";

// ─── GET (list, optionally filtered by category) ───────────────────────────

export const getCommitteeMembers = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const members = await CommitteeMember.find(filter).sort({ order: 1, createdAt: 1 });
    return res.json({ success: true, members });
  } catch (error) {
    console.error("getCommitteeMembers error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET single ──────────────────────────────────────────────────────────

export const getCommitteeMemberById = async (req, res) => {
  try {
    const member = await CommitteeMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    return res.json({ success: true, member });
  } catch (error) {
    console.error("getCommitteeMemberById error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── CREATE ──────────────────────────────────────────────────────────────

export const createCommitteeMember = async (req, res) => {
  try {
    const {
      name, designation, category, message, bio,
      order, tenureFrom, tenureTo,
    } = req.body;

    if (!name?.trim() || !category) {
      return res.status(400).json({
        success: false,
        message: "Name and category are required",
      });
    }

    let photo = "", photoPublicId = "";
    if (req.file) {
      const uploaded = await uploadImage(req.file, "housing-system/committee");
      photo = uploaded.secure_url;
      photoPublicId = uploaded.public_id;
    }

    const member = await CommitteeMember.create({
      name: name.trim(),
      designation: designation?.trim() || "",
      category,
      photo,
      photoPublicId,
      message: message?.trim() || "",
      bio: bio?.trim() || "",
      order: Number(order) || 0,
      tenureFrom: tenureFrom || "",
      tenureTo: tenureTo || "",
      createdBy: req.clerkUserId,
    });

    return res.status(201).json({ success: true, member });
  } catch (error) {
    console.error("createCommitteeMember error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────

export const updateCommitteeMember = async (req, res) => {
  try {
    const existing = await CommitteeMember.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const {
      name, designation, category, message, bio,
      order, tenureFrom, tenureTo,
    } = req.body;

    if (name)                     existing.name        = name.trim();
    if (designation !== undefined) existing.designation = designation.trim();
    if (category)                 existing.category    = category;
    if (message !== undefined)    existing.message     = message.trim();
    if (bio !== undefined)        existing.bio         = bio.trim();
    if (order !== undefined)      existing.order       = Number(order) || 0;
    if (tenureFrom !== undefined) existing.tenureFrom  = tenureFrom;
    if (tenureTo !== undefined)   existing.tenureTo    = tenureTo;

    if (req.file) {
      await deleteImage(existing.photoPublicId);
      const uploaded = await uploadImage(req.file, "housing-system/committee");
      existing.photo = uploaded.secure_url;
      existing.photoPublicId = uploaded.public_id;
    }

    await existing.save();
    return res.json({ success: true, member: existing });
  } catch (error) {
    console.error("updateCommitteeMember error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────

export const deleteCommitteeMember = async (req, res) => {
  try {
    const member = await CommitteeMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    await deleteImage(member.photoPublicId);
    await CommitteeMember.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: "Member deleted" });
  } catch (error) {
    console.error("deleteCommitteeMember error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};