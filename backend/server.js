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
import calendarAccountRoutes from './routes/calendarAccountRoutes.js';
import microsoftWebhookRoutes from './routes/microsoftWebhookRoutes.js';
import sseRoutes from './routes/sseRoutes.js';
import agenda from './utils/agendaUtils.js';
import { redisClient } from './config/redis.js';

// Import workers to start them
import { googleEventsWorker, googleCalendarListWorker } from './workers/googleWebhookWorker.js';
import { microsoftEventsWorker, microsoftCalendarListWorker } from "./workers/microsoftWebhookWorker.js";
import logger from "./utils/logger.js";

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
app.use('/api/auth', authRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/microsoft', microsoftRoutes);
app.use('/api/user', userRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/webhook/google', googleWebhookRoutes);
app.use('/api/webhook/microsoft', microsoftWebhookRoutes);
app.use('/api/calendarAccount', calendarAccountRoutes);
app.use('/api/sse', sseRoutes);

const PORT = process.env.PORT || 5000;

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  try {
    // Close BullMQ workers
    await googleEventsWorker.close();
    await googleCalendarListWorker.close();
    await microsoftEventsWorker.close();
    await microsoftCalendarListWorker.close();
    logger.info('BullMQ workers closed');
    
    // Close Redis connection
    await redisClient.quit();
    logger.info('Redis connection closed');
    
    // Stop Agenda
    await agenda.stop();
    logger.info('Agenda stopped');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.listen(PORT, async () => {
  try {
    // Connect to MongoDB
    await connectToDB();
    
    // Start Agenda
    await agenda.start();
    
    // Redis connection is already established by importing the client
    // Just verify it's connected
    logger.info('Redis status:', redisClient.status);
    
    // Workers are already running by importing them
    logger.info('✅ BullMQ workers initialized and running');
    
    logger.info(`Server running on port ${PORT}`);
  } catch (error) {

    logger.error('Failed to start server:', error);
    process.exit(1);
  }
});