import express from "express";
import { protect, protectAdmin } from "../middleware/authMiddleware.js";
import { getPaymentHistory, markPaymentAsPaid, createMonthlyPayment } from "../controllers/paymentController.js";

const paymentRouter = express.Router();

paymentRouter.get("/me", protect, getPaymentHistory);
paymentRouter.put("/:id/pay", protect, markPaymentAsPaid);
paymentRouter.post("/", protectAdmin, createMonthlyPayment);

export default paymentRouter;