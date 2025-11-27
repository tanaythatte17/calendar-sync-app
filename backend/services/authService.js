import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import generateTokenAndSetCookie from "../utils/generateToken.js";
import { sendOTPEmail } from "../utils/sendMail.js";

export async function signup(res, { name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    const error = new Error("User already exists");
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new User({
    name,
    email,
    password: hashedPassword,
  });
  await newUser.save();

  const token = generateTokenAndSetCookie(newUser._id, res);
  return {
    id: newUser._id,
    name: newUser.name,
    email: newUser.email, 
  };
}

export async function login(res, { email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Such user does not exist");
    error.statusCode = 400;
    throw error;
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    const error = new Error("Incorrect Password");
    error.statusCode = 400;
    throw error;
  }

  const token = generateTokenAndSetCookie(user._id, res);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
}

export function logout(res) {
  // Clear cookie with the SAME attributes used when setting it
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
    path: "/",
  });
  // Fallback for some clients that ignore clearCookie with attributes
  res.cookie("jwt", "", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
    path: "/",
    expires: new Date(0),
  });
  return { message: "Successfully logged out" };
}

export function getMe(user) {
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  const { _id, name, email } = user;
  return { data: { id: _id, name, email } };
}

export async function forgotPasswordService(email) {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("User with this email does not exist");
    error.statusCode = 400;
    throw error;
  }

  const otp = Math.floor(100000 + Math.random() * 900000);

  user.forgotPasswordOTP = otp;
  user.forgotPasswordOTPExpires = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  // Send OTP via email
  try {
    await sendOTPEmail(email, otp, user.name);
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    
    // Clear OTP if email fails
    user.forgotPasswordOTP = undefined;
    user.forgotPasswordOTPExpires = undefined;
    await user.save();
    
    const error = new Error("Failed to send OTP email");
    error.statusCode = 500;
    throw error;
  }

  return {
    message: "OTP sent to your email successfully"
  };
}

export async function verifyOTPService(email, otp) {
  const user = await User.findOne({email});
  if(!user){
    const error = new Error("User with this email does not exist");
    error.statusCode = 400;
    throw error;
  }

  const existingOTP = user.forgotPasswordOTP;
  otp = Number(otp);
  if (!existingOTP || existingOTP !== otp) {
    const error = new Error("Invalid OTP");
    error.statusCode = 400;
    throw error;
  }
  if (user.forgotPasswordOTPExpires < Date.now()) {
    const error = new Error("OTP has expired");
    error.statusCode = 400;
    throw error;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordTokenExpires = new Date(Date.now() + 5 * 60 * 1000);

  user.forgotPasswordOTP = undefined;
  user.forgotPasswordOTPExpires = undefined;
  await user.save();

  return ({
    "resetToken": resetToken,
    "message":"OTP verified successfully"
  });
}

export const setNewPasswordService = async (email, newPassword, confirmNewPassword, resetToken) => {
  const user = await User.findOne({
    email,
    resetPasswordToken: resetToken,
  });

  if (!user){
    const error = new Error("User with this email does not exist");
    error.statusCode = 400;
    throw error;
  }

  if(user.resetPasswordTokenExpires < Date.now()){
    const error = new Error('Reset Password Time has expired');
    error.statusCode = 400;
    throw error;
  }

  if(newPassword !== confirmNewPassword){
    const error = new Error('Passwords do not match');
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  if(hashedPassword === user.password){
    const error = new Error('New password must be different from the old password');
    error.statusCode = 400;
    throw error;
  }

  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpires = undefined;
  await user.save();

  return ({
    "message":"Password reset successfully"
  });
}