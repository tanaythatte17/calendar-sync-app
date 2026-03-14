import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const generateTokenAndSetCookie = (userId, res) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '15d'
    });
    res.cookie("jwt", token, {
        maxAge: 24 * 60 * 60 * 1000, // 15 days in ms
        httpOnly: true,
        secure: 'true', // or 'strict' if frontend/backend are on same domain
        sameSite: 'none',
    });
    return token;
}
export default generateTokenAndSetCookie;