// client/src/utils/axiosInstance.js
// Axios instance configured once at module load time.
// Import this instead of bare 'axios' throughout the frontend.

import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
  timeout: 15000,
});

export default axiosInstance;