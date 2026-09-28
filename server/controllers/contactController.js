// server/controllers/contactController.js
//
// Public endpoint — no login required, since visitors reaching the
// Contact page may not be members yet. Because it's public, this is a
// realistic spam target, so it's protected two ways: a dedicated,
// tighter rate limit (see server.js) separate from the general API
// limiter, and a honeypot field (see contactRoutes.js / frontend) that
// silently discards obvious bot submissions without telling the bot
// it failed.

// import { sendContactMessageEmail } from "../services/emailService.js";
// ^ exact import will match whatever emailService.js actually exports —
//   filling this in once you share the file.

const MAX_MESSAGE_LENGTH = 3000;
const MAX_NAME_LENGTH    = 100;
const MAX_SUBJECT_LENGTH = 200;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot — a real visitor never fills this in (it's hidden by
    // CSS on the form); a bot filling every field will. Silently
    // pretend success so the bot doesn't learn to look for another way in.
    if (website) {
      return res.status(200).json({ success: true, message: "Message sent" });
    }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required",
      });
    }

    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    if (name.trim().length > MAX_NAME_LENGTH) {
      return res.status(400).json({ success: false, message: "Name is too long" });
    }
    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: "Message is too long" });
    }

    // Strip line breaks from the subject specifically — even though
    // Resend's API takes structured fields (not raw SMTP text, so
    // classic header-injection isn't directly possible here), this is
    // cheap, defensive hygiene against a subject line that tries to
    // look like multiple lines in the eventual notification email.
    const cleanSubject = (subject || "").replace(/[\r\n]/g, " ").trim().slice(0, MAX_SUBJECT_LENGTH);

    // await sendContactMessageEmail({
    //   name:    name.trim(),
    //   email:   email.trim().toLowerCase(),
    //   subject: cleanSubject || "New message from the contact page",
    //   message: message.trim(),
    // });

    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    console.error("submitContactMessage error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to send message. Please try again." });
  }
};
