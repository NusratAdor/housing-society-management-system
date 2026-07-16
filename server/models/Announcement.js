// models/Announcement.js
//
// Separate from Notice on purpose — this isn't a document members read,
// it's a transient homepage banner with its own lifecycle concerns:
//
//   - isActive: admin can toggle off without deleting (re-enable a
//     recurring announcement later without recreating it).
//   - startDate/endDate: optional scheduling window. Both null means
//     "active immediately, no auto-expiry" — admin controls it purely
//     via isActive in that case.
//   - priority: tie-breaker if more than one announcement is active at
//     once. Higher priority wins; among equal priority, most recent
//     (createdAt) wins. This logic lives in the controller
//     (getActiveAnnouncement), not the frontend.
//   - type: drives banner color in the UI (info/warning/urgent) —
//     kept as a small fixed enum, not free text, so the frontend can
//     safely map it to a color without a fallback branch for typos.
//   - link: optional — if set, the banner is clickable (e.g. point to
//     a full Notice's detail page, or an external URL).

import mongoose from "mongoose";

export const ANNOUNCEMENT_TYPES = ["info", "warning", "urgent"];

const announcementSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: "" },
    type: { type: String, enum: ANNOUNCEMENT_TYPES, default: "info" },

    isActive:  { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate:   { type: Date, default: null },
    priority:  { type: Number, default: 0 },

    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", announcementSchema);