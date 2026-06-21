// server/models/FAQ.js
//
// CHANGES:
//   - isPublic: admin explicitly marks an FAQ as visible on the
//     home page. Defaults false — answered FAQs are private until
//     admin promotes them. This separates member support Q&A from
//     curated public content.
//   - deletedByMember: soft-delete flag. Member hiding an FAQ from
//     their view sets this true. Admin view ignores this field so
//     the document stays visible in ManageFAQs.
//   - deletedByAdmin: soft-delete flag. Admin deleting from ManageFAQs
//     sets this true. Member view filters these out. Hard-delete never
//     happens — audit trail is preserved.

import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question:        { type: String,  required: true },
    answer:          { type: String,  required: true },
    askedBy:         { type: String,  default: "Member" },
    clerkUserId:     { type: String,  default: null },
    answeredAt:      { type: Date,    default: Date.now },

    // Public promotion — only admin-toggled FAQs appear on home page
    isPublic:        { type: Boolean, default: false },

    // Soft-delete flags — independent per role
    deletedByMember: { type: Boolean, default: false },
    deletedByAdmin:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("FAQ", faqSchema);