import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { fetchTranscript } from "./api/transcript";
import chat from "./api/chat";

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

// Vite does not run Vercel functions, so the AI chat endpoint is mounted from the
// same shared handler through a dev-only middleware.
const chatDevApi = (): Plugin => ({
  name: "chat-dev-api",
  configureServer(server) {
    server.middlewares.use("/api/chat", async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const isBodyless = req.method === "GET" || req.method === "HEAD";
      const response = await chat.fetch(
        new Request("http://localhost/api/chat", {
          method: req.method ?? "GET",
          headers: { "content-type": req.headers["content-type"] ?? "application/json" },
          body: isBodyless ? undefined : Buffer.concat(chunks),
        }),
      );
      res.statusCode = response.status;
      res.setHeader("Content-Type", response.headers.get("content-type") ?? "application/json");
      res.end(await response.text());
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only secrets (no VITE_ prefix) still need to reach the dev middleware.
  const env = loadEnv(mode, process.cwd(), "");
  process.env.OPENROUTER_API_KEY ??= env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_MODEL ??= env.OPENROUTER_MODEL;

  return {
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
    chatDevApi(),
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
  };
});