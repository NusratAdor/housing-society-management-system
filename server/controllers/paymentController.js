import Payment from "../models/Payment.js";
import Member from "../models/Member.js";
import Notification from "../models/Notification.js";

export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ memberId: req.member.clerkUserId }).sort({ date: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to fetch payment history" });
  }
};

export const markPaymentAsPaid = async (req, res) => {
  try {
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.id, memberId: req.member.clerkUserId },
      { status: "Paid" },
      { new: true }
    );
    if (!payment) {
      return res.json({ success: false, message: "Payment not found" });
    }

    // Update member's payment status
    const unpaidPayments = await Payment.find({ memberId: req.member.clerkUserId, status: "Due" });
    await Member.findOneAndUpdate(
      { clerkUserId: req.member.clerkUserId },
      { paymentStatus: unpaidPayments.length > 0 ? "Due" : "Paid" }
    );

    res.json({ success: true, message: "Payment marked as paid", payment });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to mark payment as paid" });
  }
};

export const createMonthlyPayment = async (req, res) => {
  try {
    const { memberId, date, amount = 300 } = req.body;
    const month = new Date(date).toISOString().slice(0, 7); // YYYY-MM

    // Check if payment exists for this month
    const existing = await Payment.findOne({ memberId, month });
    if (existing) {
      return res.json({ success: false, message: "Payment for this month already exists" });
    }

    const payment = await Payment.create({ memberId, date, amount, month });

    // Create notification if due
    if (payment.status === "Due") {
      await Notification.create({
        memberId,
        message: `Payment of ${amount} taka due for ${month} on ${new Date(
          Date.now() + 10 * 24 * 60 * 60 * 1000
        ).toLocaleDateString()}. If not paid, it will accumulate to your due amount.`,
        date: new Date(),
      });
    }

    res.json({ success: true, message: "Payment created successfully", payment });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to create payment" });
  }
};