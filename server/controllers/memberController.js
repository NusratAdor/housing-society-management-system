import Member from "../models/Member.js";
import transporter from "../configs/nodemailer.js";

export const createMember = async (req, res) => {
  try {
    const { user } = req.auth;
    const { clerkUserId, ...profileData } = req.body;
    const data = { ...profileData, clerkUserId: user.id };

    // Check if profile already exists
    const existing = await Member.findOne({ clerkUserId: user.id });
    if (existing) {
      return res.json({ success: false, message: "Profile already exists" });
    }

    // Check membership limit (500 members)
    const totalMembers = await Member.countDocuments();
    if (totalMembers >= 500) {
      return res.json({ success: false, message: "Membership limit reached (500 members)" });
    }

    const member = await Member.create(data);

    // Send confirmation email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: member.email,
      subject: "Housing Society Membership Confirmation",
      html: `
        <h2>Welcome to the Housing Society!</h2>
        <p>Dear ${member.name},</p>
        <p>Your membership profile has been created successfully. Here are your details:</p>
        <ul>
          <li><strong>Membership Number:</strong> ${member.membershipNumber}</li>
          <li><strong>Name:</strong> ${member.name}</li>
          <li><strong>Email:</strong> ${member.email}</li>
          <li><strong>Payment Status:</strong> ${member.paymentStatus}</li>
        </ul>
        <p>Please complete your monthly payments to stay active. Contact us for any queries.</p>
      `,
    };
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Profile created successfully", member });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getMemberProfile = async (req, res) => {
  try {
    const member = req.member; // Set by protect middleware
    res.json({ success: true, member });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to fetch profile" });
  }
};

export const updateMemberProfile = async (req, res) => {
  try {
    const member = await Member.findOneAndUpdate(
      { clerkUserId: req.auth.userId },
      req.body,
      { new: true }
    );
    if (!member) {
      return res.json({ success: false, message: "Profile not found" });
    }
    res.json({ success: true, message: "Profile updated successfully", member });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to update profile" });
  }
};