// server/middleware/memberStatusMiddleware.js
//
// Enforces that self-service member actions can only be performed by
// an ACTIVE member. A removed member's Member document is intentionally
// preserved (soft delete — see memberService.deactivateMember), so
// protect still attaches req.member for them — "the record exists" is
// not the same as "this person may still use the member-facing parts
// of the system." This middleware is the single place that draws that
// line, applied only to the specific routes that need it.
//
// Deliberately NOT folded into protect itself: GET /api/members/me
// must stay reachable even for a removed member, so the frontend can
// read their status and show a clear "your account was removed"
// message, instead of the request being blocked outright with no
// explanation.

export const requireActiveMember = (req, res, next) => {
  if (!req.member) {
    return res.status(404).json({ success: false, message: "Member profile not found" });
  }

  if (req.member.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "This membership has been removed. Please contact the Society office.",
    });
  }

  next();
};