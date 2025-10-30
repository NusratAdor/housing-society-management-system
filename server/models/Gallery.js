// models/Gallery.js
import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },   // Cloudinary URL
    createdBy: { type: String, required: true }, // Clerk userId
  },
  { timestamps: true }
);

export default mongoose.model("Gallery", gallerySchema);