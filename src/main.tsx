import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkLoadRecovery } from "./lib/chunkLoadError";
import { watchPwaUpdates } from "./lib/pwaUpdates";

// A deploy replaces every hashed route chunk. Recover automatically when this tab is still
// running an older shell, and reload as soon as an updated service worker takes over.
installChunkLoadRecovery();
watchPwaUpdates();

// The database is initialised by <AppBootstrap />, which only mounts once a visitor has
// entered the access code, so the public landing page never talks to Turso.
createRoot(document.getElementById("root")!).render(<App />);
