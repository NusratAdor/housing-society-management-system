// models/CommitteeMember.js
//
// One model covers all "About Us" personnel categories via a `category`
// enum, rather than 6 separate models — the shape (name, photo,
// designation, message/bio) is identical across roles; only which
// category a record belongs to differs. This mirrors how Notice/
// Gallery already use one flexible schema instead of per-type models.
//
//   - category: drives which page a member appears on AND whether that
//     page renders as "single" (chairman, generalSecretary) or "grid"
//     (adviser, formerChairman, formerGeneralSecretary,
//     executiveCommittee) — see CommitteeSection.jsx for that mapping.
//   - message: long-form text for the "single" message-style pages
//     (Chairman/GS) — optional, since grid-type members use `bio`
//     instead.
//   - bio: short text for grid-type member cards/detail pages.
//   - order: manual sort — committee membership order matters and
//     isn't always alphabetical or chronological.
//   - tenureFrom/tenureTo: only meaningful for "former" categories,
//     left blank otherwise.

import mongoose from "mongoose";

export const COMMITTEE_CATEGORIES = [
  "chairman",
  "generalSecretary",
  "adviser",
  "formerChairman",
  "formerGeneralSecretary",
  "executiveCommittee",
];

const committeeMemberSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    designation: { type: String, trim: true, default: "" },
    category: {
      type:     String,
      enum:     COMMITTEE_CATEGORIES,
      required: true,
      index:    true,
    },

    photo:         { type: String, default: "" },
    photoPublicId: { type: String, default: "" },

    message: { type: String, default: "" }, // single-layout roles
    bio:     { type: String, default: "" }, // grid-layout roles

    order: { type: Number, default: 0 },

    tenureFrom: { type: String, default: "" },
    tenureTo:   { type: String, default: "" },

    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("CommitteeMember", committeeMemberSchema);