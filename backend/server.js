import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import googleRoutes from './routes/googleRoutes.js';
import microsoftRoutes from './routes/microsoftRoutes.js';
import authRoutes from './routes/authRoutes.js'
import connectToDB from "./db/connectDB.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth',authRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/microsoft', microsoftRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  connectToDB();
  console.log(`Server running on port ${PORT}`);
}); 