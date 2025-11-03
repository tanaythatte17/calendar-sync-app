import  express  from "express";
import {signup,login,logout, getMe} from "../controllers/authController.js"
import { authLimiter, apiLimiter } from "../services/rateLimitingService.js";
import protectRoute from "../middleware/protectRoute.js";
const router = express.Router();

router.post("/login", authLimiter, login);
router.post("/signup", authLimiter, signup);
router.post("/logout", authLimiter, logout);
router.get("/me", apiLimiter, protectRoute, getMe);

export default router;