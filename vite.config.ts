import path from "node:path";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), hercules()],
  resolve: {
    alias: {
      // MUST come first – fixes Convex generated client resolution
      "@/convex": path.resolve(__dirname, "./convex"),

      // App source
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
