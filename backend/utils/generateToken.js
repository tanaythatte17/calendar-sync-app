import jwt from "jsonwebtoken";
const generateTokenAndSetCookie = (userId, res) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '15d'
    });
    res.cookie("jwt", token, {
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in ms
        httpOnly: true,
        sameSite: "lax", // or 'strict' if frontend/backend are on same domain
        secure: process.env.NODE_ENV === 'production',
    });
    return token;
}
export default generateTokenAndSetCookie;