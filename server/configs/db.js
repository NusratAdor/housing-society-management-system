import mongoose from "mongoose";

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    console.log(" Using existing MongoDB connection");
    return;
  }

  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/housing_society`);
    console.log("✅ Database Connected Successfully");
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
    throw error; // prevents server from starting if DB fails
  }
};

export default connectDB;
