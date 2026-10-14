// server/controllers/contactController.js
//
// Public endpoint (no login): visitors using the Contact page may not be
// members. Protected by a per-IP rate limit (see contactRoutes.js) and a
// honeypot field that real users never see or fill in.

import { sendContactMessageEmail } from "../services/emailService.js";

const LIMITS = { name: 100, email: 254, subject: 200, message: 3000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Non-string input (arrays, objects, numbers) is treated as empty.
const asText = (value) => (typeof value === "string" ? value.trim() : "");

// Collapses all whitespace, including line breaks, into single spaces.
const singleLine = (value) => value.replace(/\s+/g, " ");

export const submitContactMessage = async (req, res) => {
  try {
    const body = req.body ?? {};

    // Honeypot: bots fill every field. Reply with success so the bot
    // does not learn that it was detected.
    if (body.companyWebsite) {
      return res.status(200).json({ success: true, message: "Message sent" });
    }

    const name = singleLine(asText(body.name));
    const email = asText(body.email).toLowerCase();
    const subject = singleLine(asText(body.subject));
    const message = asText(body.message);

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required",
      });
    }

    if (email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a valid email address" });
    }

    if (
      name.length > LIMITS.name ||
      subject.length > LIMITS.subject ||
      message.length > LIMITS.message
    ) {
      return res
        .status(400)
        .json({ success: false, message: "One or more fields are too long" });
    }

    await sendContactMessageEmail({
      name,
      email,
      subject: subject || "New message from the contact page",
      message,
    });

    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    // Message content is deliberately not logged (visitor privacy).
    console.error("submitContactMessage error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again.",
    });
  }
};