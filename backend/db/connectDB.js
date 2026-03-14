import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("connected to MongoDB");
    } catch (error) {
        console.log("Error connecting to DB",error.message);
    }
}
export default connectToDB;