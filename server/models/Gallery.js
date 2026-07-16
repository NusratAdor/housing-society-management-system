// models/Gallery.js
//
// CHANGE: supports MULTIPLE images per gallery item (one item = one
// event, with a set of photos), instead of a single image.
//
//   - images: array of { url, publicId }, one entry per uploaded photo.
//     images[0] is always treated as the "cover" photo — the one shown
//     in GalleryCard thumbnails and on the homepage CommunityGallery
//     section, per the request that only the first image appears there.
//   - Custom validator ensures images can't be saved as an empty array
//     (Mongoose's `required: true` on an array only checks the field
//     is present, not that it's non-empty, so this needs an explicit
//     validate function).
//   - image / imagePublicId: kept as legacy fields, same backward-
//     compatibility pattern already used in the Notice model (image /
//     imagePublicId there). These always mirror images[0] going
//     forward — anything still reading item.image directly (like the
//     current GalleryCard.jsx) keeps working with zero changes needed
//     on that end.

import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Multiple images — one gallery item can now hold several photos
    // from the same event.
    images: {
      type: [
        {
          url:      { type: String, required: true },
          publicId: { type: String, required: true },
        },
      ],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one image is required",
      },
    },

    // Legacy single-image fields — always mirror images[0].
    image: {
      type: String,
      default: "",
    },

    imagePublicId: {
      type: String,
      default: "",
    },

    createdBy: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Gallery", gallerySchema);