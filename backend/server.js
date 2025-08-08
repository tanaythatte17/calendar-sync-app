import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import googleRoutes from './routes/googleRoutes.js';
import microsoftRoutes from './routes/microsoftRoutes.js';
import authRoutes from './routes/authRoutes.js'
import connectToDB from "./db/connectDB.js";
import userRoutes from "./routes/userRoutes.js";
import calendarRoutes from './routes/calendarRoutes.js';
import googleWebhookRoutes from './routes/googleWebhookRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth',authRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/microsoft', microsoftRoutes);
app.use('/api/user', userRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/webhook/google', googleWebhookRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  connectToDB();
  console.log(`Server running on port ${PORT}`);
}); 