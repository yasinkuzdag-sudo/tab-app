import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,

    // 🔑 Teams + ngrok için kritik
    host: true,
    allowedHosts: [
      "localhost",
      ".ngrok-free.dev",
    ],

    // 🔑 Teams iframe içinde açılabilsin diye
    headers: {
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  },
});