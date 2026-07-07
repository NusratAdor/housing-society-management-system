// server/controllers/memberSeatController.js
//
// Admin CRUD for MemberSeat records.
//
// Rules:
//   - Any seat can be created or deleted if unclaimed
//   - Claimed seats: only name, plotNo, designation can be updated
//   - membershipNo and joinDate are locked once claimed (charges already generated)
//   - Deleting a claimed seat is blocked — member already has an account

import MemberSeat from "../models/MemberSeat.js";

// ── List all seats ────────────────────────────────────────────────────────────

export const getAllSeats = async (req, res) => {
  try {
    const seats = await MemberSeat
      .find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, seats });
  } catch (error) {
    console.error("getAllSeats error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Create a new seat ─────────────────────────────────────────────────────────

export const createSeat = async (req, res) => {
  try {
    const { membershipNo, name, plotNo, designation, joinDate } = req.body;

    if (!membershipNo?.trim()) {
      return res.status(400).json({ success: false, message: "Membership number is required" });
    }
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!joinDate) {
      return res.status(400).json({ success: false, message: "Join date is required" });
    }

    const cleanMembershipNo = membershipNo.trim().toUpperCase();

    // Check for duplicate
    const existing = await MemberSeat.findOne({ membershipNo: cleanMembershipNo });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Membership number ${cleanMembershipNo} already exists`,
      });
    }

    const seat = await MemberSeat.create({
      membershipNo: cleanMembershipNo,
      name:         name.trim(),
      plotNo:       plotNo?.trim() || "",
      designation:  designation?.trim() || "",
      joinDate:     new Date(joinDate),
    });

    return res.status(201).json({ success: true, seat });
  } catch (error) {
    console.error("createSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Update a seat ─────────────────────────────────────────────────────────────

export const updateSeat = async (req, res) => {
  try {
    const seat = await MemberSeat.findById(req.params.id);
    if (!seat) {
      return res.status(404).json({ success: false, message: "Seat not found" });
    }

    const { membershipNo, name, plotNo, designation, joinDate } = req.body;

    if (seat.isClaimed) {
      // Claimed seat — only display fields can change
      // membershipNo and joinDate are locked because charges are already generated
      if (name)        seat.name        = name.trim();
      if (plotNo)      seat.plotNo      = plotNo.trim();
      if (designation) seat.designation = designation.trim();

      // Silently ignore membershipNo and joinDate changes on claimed seats
    } else {
      // Unclaimed seat — all fields can change
      if (membershipNo) {
        const clean = membershipNo.trim().toUpperCase();
        // Check uniqueness only if the number is actually changing
        if (clean !== seat.membershipNo) {
          const conflict = await MemberSeat.findOne({ membershipNo: clean });
          if (conflict) {
            return res.status(400).json({
              success: false,
              message: `Membership number ${clean} already exists`,
            });
          }
          seat.membershipNo = clean;
        }
      }
      if (name)        seat.name        = name.trim();
      if (plotNo)      seat.plotNo      = plotNo.trim();
      if (designation) seat.designation = designation.trim();
      if (joinDate)    seat.joinDate    = new Date(joinDate);
    }

    await seat.save();
    return res.status(200).json({ success: true, seat });
  } catch (error) {
    console.error("updateSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Delete a seat ─────────────────────────────────────────────────────────────

export const deleteSeat = async (req, res) => {
  try {
    const seat = await MemberSeat.findById(req.params.id);
    if (!seat) {
      return res.status(404).json({ success: false, message: "Seat not found" });
    }

    if (seat.isClaimed) {
      return res.status(400).json({
        success: false,
        message:
          "This seat has been claimed by a registered member. " +
          "Delete the member account first if you need to remove this seat.",
      });
    }

    await MemberSeat.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Seat deleted" });
  } catch (error) {
    console.error("deleteSeat error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};