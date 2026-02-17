import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const supabaseUrl = (env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api/mcsrvstat": {
          target: "https://api.mcsrvstat.us",
          changeOrigin: true,
          rewrite: (pathToRewrite) => pathToRewrite.replace(/^\/api\/mcsrvstat/, ""),
        },
        ...(supabaseUrl
          ? {
              "/functions/v1": {
                target: supabaseUrl,
                changeOrigin: true,
                secure: true,
              },
            }
          : {}),
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
