import express from "express";
import { protect, protectAdmin } from "../middleware/authMiddleware.js";
import { submitQuestion, getUserQuestions, answerQuestion } from "../controllers/questionController.js";

const questionRouter = express.Router();

questionRouter.post("/", protect, submitQuestion);
questionRouter.get("/me", protect, getUserQuestions);
questionRouter.put("/:id", protectAdmin, answerQuestion);

export default questionRouter;