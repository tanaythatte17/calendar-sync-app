import  express  from "express";
import {signup,login,logout, getMe, forgotPassword, verifyOTP, setNewPassword} from "../controllers/authController.js"
import { authLimiter, apiLimiter } from "../services/rateLimitingService.js";
import protectRoute from "../middleware/protectRoute.js";
const router = express.Router();

router.post("/login", authLimiter, login);
router.post("/signup", authLimiter, signup);
router.post("/logout", authLimiter, logout);
router.get("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-otp", authLimiter, verifyOTP);
router.post("/reset-password", authLimiter, setNewPassword);
router.get("/me", apiLimiter, protectRoute, getMe);

export default router;