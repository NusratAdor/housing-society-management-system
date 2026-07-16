// models/Event.js
//
// Mirrors CommitteeMember.js / Announcement.js conventions.
//
//   - eventDate: single date the event occurs (or occurred). Upcoming
//     vs Past is never stored as a status flag — it's derived by
//     comparing eventDate to "now," exactly like Announcement's
//     isActive/startDate/endDate resolution. A stored status would
//     need a cron job to flip it at midnight; deriving it avoids that
//     entirely and can never drift out of sync with reality.
//   - excerpt: short summary for card/list views. description is the
//     full body shown on the event's own detail page — same
//     short/long split as Notice's title/summary/content elsewhere.
//   - image / imagePublicId: Cloudinary, same upload/cleanup pattern
//     as CommitteeMember's photo field.
//   - isPublished: admin visibility toggle, same idea as
//     Announcement's isActive — hide an event without deleting it.

import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    excerpt:     { type: String, trim: true, default: "" },
    description: { type: String, required: true, trim: true },
    location:    { type: String, trim: true, default: "" },

    eventDate: { type: Date, required: true },

    image:         { type: String, default: "" },
    imagePublicId: { type: String, default: "" },

    isPublished: { type: Boolean, default: true },

    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

eventSchema.index({ eventDate: -1 });

export default mongoose.model("Event", eventSchema);