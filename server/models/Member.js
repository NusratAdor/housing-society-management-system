import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────────────────────────────
    // Clerk identity
    // ─────────────────────────────────────────────────────────────
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    profileImageUrl: {
      type: String,
      default: null,
      trim: true,
    },

    // ─────────────────────────────────────────────────────────────
    // Personal information
    // ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    /*
     * Current member phone.
     *
     * IMPORTANT:
     * This is NOT the original registration credential.
     * The original registered phone lives in MemberSeat.registeredPhone.
     */
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // ─────────────────────────────────────────────────────────────
    // Address information
    // ─────────────────────────────────────────────────────────────
    permanentAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    presentAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // ─────────────────────────────────────────────────────────────
    // Membership
    // ─────────────────────────────────────────────────────────────
    membershipNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // ─────────────────────────────────────────────────────────────
    // Multiple plots
    // ─────────────────────────────────────────────────────────────
    plots: {
      type: [
        {
          _id: false,

          plotNo: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxlength: 50,
          },

          plotSize: {
            type: Number,
            required: true,
            enum: [13, 10, 9, 7, 6.5],
          },
        },
      ],

      required: true,

      validate: {
        validator: (plots) => Array.isArray(plots) && plots.length > 0,

        message: "At least one plot is required",
      },
    },

    // ─────────────────────────────────────────────────────────────
    // Nominee
    // ─────────────────────────────────────────────────────────────
    nominee: {
      type: {
        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: 100,
        },

        phone: {
          type: String,
          required: true,
          trim: true,
        },

        email: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },
      },

      required: true,
    },

    // ─────────────────────────────────────────────────────────────
    // Authorization / role
    // ─────────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },

    pendingAdmin: {
      type: Boolean,
      default: false,
    },

    // ─────────────────────────────────────────────────────────────
    // Soft deletion
    // ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "removed"],
      default: "active",
    },

    removedAt: {
      type: Date,
      default: null,
    },

    removedBy: {
      type: String,
      default: null,
    },

    // ─────────────────────────────────────────────────────────────
    // Payment concurrency marker
    // KEEP this.
    // ─────────────────────────────────────────────────────────────
    creditVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

memberSchema.index({ role: 1 });
memberSchema.index({ status: 1 });

export default mongoose.model("Member", memberSchema);
