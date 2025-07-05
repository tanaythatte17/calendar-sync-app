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
    required: true
    // Store hashed password using bcrypt or argon2
  },
  name: {
    type: String,
    required: true
  },
  calendarAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarAccount'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", UserSchema);
export default User;