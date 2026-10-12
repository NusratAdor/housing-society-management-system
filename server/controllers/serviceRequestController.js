import ServiceRequest from "../models/ServiceRequest.js";
import Notification from "../models/Notification.js";
import { parseDateString, getDhakaDateParts } from "../utils/dateTime.js";
import { normalizePhone, isValidPhone } from "../utils/phoneUtils.js";
import { httpError } from "../utils/httpError.js";

const SERVICE_NAMES = {
  "guest-house": "guest house booking",
  water: "water service",
  electrical: "electrical service",
};

const pad = (n) => String(n).padStart(2, "0");

const text = (value, label, { min = 0, max }) => {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length < min) {
    throw httpError(400, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`);
  }
  if (s.length > max) throw httpError(400, `${label} must be ${max} characters or less`);
  return s;
};

const dateText = (value, label) => {
  const p = parseDateString(value);
  if (!p) throw httpError(400, `${label} must be a valid date`);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

const todayText = () => {
  const { year, month, day } = getDhakaDateParts();
  return `${year}-${pad(month)}-${pad(day)}`;
};

const buildGuestHouse = (body) => {
  const checkIn = dateText(body.checkIn, "Check-in date");
  const checkOut = dateText(body.checkOut, "Check-out date");
  if (checkIn < todayText()) throw httpError(400, "Check-in cannot be in the past");
  if (checkOut <= checkIn) throw httpError(400, "Check-out must be after check-in");

  const guests = Number(body.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    throw httpError(400, "Number of guests must be between 1 and 20");
  }

  let contactNumber = null;
  try {
    contactNumber = normalizePhone(body.contactNumber);
  } catch {
    contactNumber = null;
  }
  if (!contactNumber || !isValidPhone(contactNumber)) throw httpError(400, "Enter a valid contact number");

  return {
    stay: {
      checkIn,
      checkOut,
      guestName: text(body.guestName, "Guest name", { min: 2, max: 100 }),
      guests,
      contactNumber,
      purpose: text(body.purpose, "Purpose of stay", { min: 1, max: 200 }),
    },
    details: text(body.note, "Additional note", { max: 1000 }),
  };
};

const buildUtility = (body, member) => {
  // The plot must be one of the member's own plots. Never trust the client.
  const plotNo = typeof body.plotNo === "string" ? body.plotNo.trim().toUpperCase() : "";
  const plot = (member.plots || []).find((p) => p.plotNo === plotNo);
  if (!plot) throw httpError(400, "Please choose one of your plots");

  return {
    plot: { plotNo: plot.plotNo, plotSize: plot.plotSize },
    issueType: text(body.issueType, "Service type", { min: 1, max: 60 }),
    details: text(body.description, "Description", { min: 10, max: 1000 }),
  };
};

const sendError = (res, label, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ success: false, message: "Server error" });
};

// ─── Member: POST /api/service-requests ─────────────────────────────────────

export const createRequest = async (req, res) => {
  try {
    const body = req.body ?? {};
    const serviceType = body.serviceType;

    if (!SERVICE_NAMES[serviceType]) {
      return res.status(400).json({ success: false, message: "Invalid service" });
    }

    const fields =
      serviceType === "guest-house" ? buildGuestHouse(body) : buildUtility(body, req.member);

    await ServiceRequest.create({ member: req.member._id, serviceType, ...fields });

    // Tells the office. Best effort: a failure here never fails the request.
    try {
      await Notification.create({
        type: "ServiceRequest",
        adminOnly: true,
        content:
          `New ${SERVICE_NAMES[serviceType]} request from ${req.member.name} (${req.member.membershipNo})` +
          (fields.stay ? `, ${fields.stay.checkIn} to ${fields.stay.checkOut}` : ""),
      });
    } catch (error) {
      console.error("[ServiceRequest] notification failed:", error.message);
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    return sendError(res, "createRequest", error);
  }
};

// ─── Admin ──────────────────────────────────────────────────────────────────

export const getServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find()
      .populate("member", "name membershipNo phone")
      .sort({ createdAt: -1 })
      .limit(200)
      .select("-__v")
      .lean();

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    return sendError(res, "getServiceRequests", error);
  }
};

export const markRequestDone = async (req, res) => {
  try {
    const updated = await ServiceRequest.findOneAndUpdate(
      { _id: req.params.id, status: "new" },
      { $set: { status: "done", handledBy: req.clerkUserId, handledAt: new Date() } },
    );

    if (!updated) {
      const exists = await ServiceRequest.exists({ _id: req.params.id });
      throw httpError(exists ? 409 : 404, exists ? "This request is already done" : "Request not found");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, "markRequestDone", error);
  }
};