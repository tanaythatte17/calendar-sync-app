import mongoose from "mongoose";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();
const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info("connected to MongoDB");
    } catch (error) {
        logger.info("Error connecting to DB",error.message);
    }
}
export default connectToDB;