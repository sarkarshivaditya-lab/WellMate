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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — tiny, shared everywhere, cache forever
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // Convex + Auth — change together, separate from UI
          if (
            id.includes("node_modules/convex/") ||
            id.includes("node_modules/@auth0/")
          ) {
            return "vendor-auth";
          }
          // All Radix UI — large collective, changes infrequently
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Sheet/dialog overlays — cmdk, vaul, sonner
          if (
            id.includes("node_modules/cmdk/") ||
            id.includes("node_modules/vaul/") ||
            id.includes("node_modules/sonner/")
          ) {
            return "vendor-overlays";
          }
        },
      },
    },
  },
});
