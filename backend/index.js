import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import connectToDB from './db/connection.js';

// Load environment variables
dotenv.config();

// Import routes and controllers
import authRoutes from './routes/auth.js';
import googleController from './controllers/googleController.js';
import microsoftController from './controllers/microsoftController.js';
import calendarRoutes from './routes/calendarRoutes.js';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);

// Google Calendar routes
app.get('/api/google/auth', googleController.redirectToGoogle);
app.get('/api/google/callback', googleController.handleGoogleCallback);
app.post('/api/google/sync', googleController.syncGoogleEvents);
app.post('/api/google/events', googleController.createGoogleEvent);
app.post('/api/google/disconnect', googleController.disconnectGoogle);

// Microsoft Calendar routes
app.get('/api/microsoft/auth', microsoftController.redirectToMicrosoft);
app.get('/api/microsoft/callback', microsoftController.handleMicrosoftCallback);
app.post('/api/microsoft/sync', microsoftController.syncMicrosoftEvents);
app.post('/api/microsoft/events', microsoftController.createMicrosoftEvent);
app.post('/api/microsoft/disconnect', microsoftController.disconnectMicrosoft);

// Calendar sync routes
app.use('/api/calendar', calendarRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectToDB();
    
    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();