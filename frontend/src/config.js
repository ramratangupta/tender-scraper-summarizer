// Config file that works in both Vite and Jest
const config = {
  apiUrl: process.env.VITE_API_URL || "http://localhost:2900/api"
};

export default config;