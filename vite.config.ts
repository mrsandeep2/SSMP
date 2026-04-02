import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;

          if (/node_modules\/(react|react-dom|react-router-dom)\//.test(id)) {
            return "vendor";
          }

          if (
            id.includes("@radix-ui") ||
            id.includes("lucide-react") ||
            id.includes("sonner") ||
            id.includes("vaul") ||
            id.includes("cmdk")
          ) {
            return "ui";
          }

          if (
            id.includes("date-fns") ||
            id.includes("zod") ||
            id.includes("clsx") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge")
          ) {
            return "utils";
          }

          return "vendor";
        },
      },
    },
  },
}));
