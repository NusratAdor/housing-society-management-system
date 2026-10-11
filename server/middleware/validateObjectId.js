// server/middleware/validateObjectId.js
// An invalid :id used to reach Mongoose and come back as a 500 CastError.
// Usage: router.put("/:id/confirm", protect, isAdmin, validateObjectId(), approvePayment);

const OBJECT_ID = /^[a-f\d]{24}$/i;

export const validateObjectId = (...params) => (req, res, next) => {
  const names = params.length > 0 ? params : ["id"];

  for (const name of names) {
    if (!OBJECT_ID.test(String(req.params[name] ?? ""))) {
      return res.status(400).json({ success: false, message: `Invalid ${name}` });
    }
  }
  next();
};