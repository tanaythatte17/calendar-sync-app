import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false  // Changed to false for OAuth users
  },
  name: {
    type: String,
    required: true
  },
  // OAuth provider fields
  googleId: {
    type: String,
    unique: true,
    sparse: true  // Allows null values while maintaining uniqueness
  },
  microsoftId: {
    type: String,
    unique: true,
    sparse: true
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'microsoft'],
    default: 'local'
  },
  calendarAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarAccount'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  timezone: {
    type: String,
    default: 'UTC',
  },
  forgotPasswordOTP: { type: Number },
  forgotPasswordOTPExpires: { type: Date },
  resetPasswordToken: { type: String },  
  resetPasswordTokenExpires: { type: Date }
});

const User = mongoose.model("User", UserSchema);
export default User;