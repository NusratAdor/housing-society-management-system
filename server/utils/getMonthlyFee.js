// utils/getMonthlyFee.js
import Settings from "../models/Settings.js";

const DEFAULT_MONTHLY_FEE = 500; // fallback if DB has no record yet

export const getMonthlyFee = async () => {
  try {
    const setting = await Settings.findOne({ key: "monthlyFee" });
    return setting ? Number(setting.value) : DEFAULT_MONTHLY_FEE;
  } catch {
    return DEFAULT_MONTHLY_FEE;
  }
};