import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ensureSchema, flushSrsQueue } from "@/integrations/turso/db";
import "./index.css";

ensureSchema().catch((e) => {
  console.error("Failed to initialize database schema:", e);
});

flushSrsQueue();

createRoot(document.getElementById("root")!).render(<App />);