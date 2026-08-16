import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ensureSchema } from "@/integrations/turso/db";
import "./index.css";

ensureSchema().catch((e) => {
  console.error("Failed to initialize database schema:", e);
});

createRoot(document.getElementById("root")!).render(<App />);
