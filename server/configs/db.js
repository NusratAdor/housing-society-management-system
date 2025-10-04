import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => console.log("Database Connected"));
    await mongoose.connect(`${process.env.MONGODB_URI}/housing_society`);
  } catch (error) {
    console.log("DB Connection Error:", error.message);
  }
};

export default connectDB;