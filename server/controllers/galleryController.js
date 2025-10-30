// controllers/galleryController.js
import Gallery from "../models/Gallery.js";
import Notification from "../models/Notification.js";
import { v2 as cloudinary } from "cloudinary";

export const createGalleryItem = async (req, res) => {
  try {
    const { title, description } = req.body;
    const createdBy = req.auth.userId;

    if (!title || !description || !req.file) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const upload = await cloudinary.uploader.upload(req.file.path);
    const image = upload.secure_url;

    const item = await Gallery.create({ title, description, image, createdBy });

    // ---- Recent Activity (only on create) ----
    await Notification.create({
      type: "Gallery",
      content: `New gallery item added: ${title}`,
      adminOnly: true,
    });

    res.status(201).json({ success: true, message: "Gallery item created", item });
  } catch (err) {
    console.error("createGalleryItem error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getGalleryItems = async (req, res) => {
  try {
    const items = await Gallery.find().sort({ createdAt: -1 });
    res.json({ success: true, gallery: items });
  } catch (err) {
    console.error("getGalleryItems error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateGalleryItem = async (req, res) => {
  try {
    const { title, description } = req.body;
    const createdBy = req.auth.userId;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title & description required" });
    }

    const old = await Gallery.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: "Not found" });

    let image = old.image;
    if (req.file) {
      const up = await cloudinary.uploader.upload(req.file.path);
      image = up.secure_url;
    }

    const updated = await Gallery.findByIdAndUpdate(
      req.params.id,
      { title, description, image, createdBy },
      { new: true }
    );

    res.json({ success: true, message: "Gallery item updated", item: updated });
  } catch (err) {
    console.error("updateGalleryItem error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteGalleryItem = async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });

    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Gallery item deleted" });
  } catch (err) {
    console.error("deleteGalleryItem error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};