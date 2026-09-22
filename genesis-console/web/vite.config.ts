import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.VITE_PORT ?? 5173),
    proxy: {
      "/auth/": process.env.VITE_API_ORIGIN ?? "http://127.0.0.1:8080",
      "/events/": process.env.VITE_API_ORIGIN ?? "http://127.0.0.1:8080",
      "/sbom/": process.env.VITE_API_ORIGIN ?? "http://127.0.0.1:8080",
      "/console.v1.ConsoleService": process.env.VITE_API_ORIGIN ?? "http://127.0.0.1:8080",
    },
  },
});
