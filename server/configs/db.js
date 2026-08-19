import mongoose from "mongoose";

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    console.log(" Using existing MongoDB connection");
    return;
  }

  const dbName = process.env.MONGODB_DB_NAME || "housing_society";

  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${dbName}`);
    console.log(`✅ Database Connected Successfully (${dbName})`);
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
    throw error;
  }
};

export default connectDB;