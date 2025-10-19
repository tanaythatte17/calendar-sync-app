import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import generateTokenAndSetCookie from "../utils/generateToken.js";

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


