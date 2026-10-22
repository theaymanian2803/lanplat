import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { fetchTranscript } from "./api/transcript";

// Vite does not run Vercel functions, so the transcript endpoint is served from the
// same shared implementation through a dev-only middleware.
const transcriptDevApi = (): Plugin => ({
  name: "transcript-dev-api",
  configureServer(server) {
    server.middlewares.use("/api/transcript", async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const result = await fetchTranscript(
        url.searchParams.get("videoId") ?? "",
        url.searchParams.get("lang") ?? "",
      );
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.statusCode = result.ok ? 200 : result.status;
      res.end(
        JSON.stringify(
          result.ok ? result.data : { error: result.error, reason: result.reason },
        ),
      );
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/gutenberg": {
        target: "https://www.gutenberg.org",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url ?? "";
            proxyReq.path = url.replace(/^\/gutenberg/, "");
          });
          proxy.on("proxyRes", (proxyRes) => {
            const location = proxyRes.headers["location"];
            if (typeof location === "string") {
              const parsed = new URL(location, "https://www.gutenberg.org");
              if (parsed.hostname === "www.gutenberg.org") {
                proxyRes.headers["location"] = `/gutenberg${parsed.pathname}`;
              }
            }
          });
        },
      },
    },
  },
  plugins: [
    react(),
    transcriptDevApi(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "LingoVault — Language Learning",
        short_name: "LingoVault",
        description:
          "Personal language learning dashboard for studying with YouTube videos, timestamped notes, vocabulary tracking, and spaced-repetition flashcards.",
        theme_color: "#191b16",
        background_color: "#191b16",
        display: "standalone",
        start_url: "/dashboard",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        navigateFallback: "/index.html",
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));