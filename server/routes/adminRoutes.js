import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js";
import {
  getAllMembers,
  updateMemberProfile,
  deleteMember,
  approveAdmin,
} from "../controllers/adminController.js";

const router = express.Router();

// Only Admin can access these routes
router.use(protect, isAdmin);

router.get("/members", getAllMembers); 
router.put("/members/:id", updateMemberProfile);
router.delete("/members/:id", deleteMember);
router.put("/members/:id/approve", approveAdmin);



export default router;