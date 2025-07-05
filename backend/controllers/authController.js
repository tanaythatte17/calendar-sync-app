import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import generateTokenAndSetCookie from "../utils/generateToken.js";

export const signup = async (req,res) => {
    try{
        const {name,email,password,confirmPassword} = req.body;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if(password !== confirmPassword){
            return res.status(400).json({error:"Passwords don't match"});
        }
        const user = await User.findOne({email});
        if(user){
            return res.status(400).json({error:"User already exists"});
        }
        const salt  = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);
        const newUser = new User({
            name,
            email,
            password:hashedPassword,
        });
        await newUser.save();
        if(newUser){
            generateTokenAndSetCookie(newUser._id,res);
            return res.status(201).json({
                id : newUser._id,
                name : newUser.name,
                email : newUser.email,
            });
        }
        else{
            return res.statu(400).json({error:"Invalid User Data"});
        }
    }
    catch(error){
        console.log(error.message);
        return res.status(400).json({error:"Internal error in creating user"});
    }
}
export const login = async (req,res) => {
    try {
        const {email,password} = req.body;
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({error:"Such user does not exist"});
        }
        const isPasswordCorrect = await bcrypt.compare(password,user.password);
        if(!isPasswordCorrect){
            return res.status(400).json({error:"Incorrect Password"});
        }
        const token = generateTokenAndSetCookie(user._id,res);
        return res.status(200).json({
            id:user._id,
            name:user.name,
            email:user.email,
            token
        });
    } catch (error) {
        console.log(error.message);
        res.status(400).json({error:"Internal error in creating user"});
    }
}
export const logout = (req,res) => {
    try {
        res.cookie("jwt","",{maxAge:0});
        res.status(200).json({message:"Successfully logged out"});
    } catch (error) {
        console.log(error.message);
        res.status(400).json({error:"Internal error in creating user"});
    }
}