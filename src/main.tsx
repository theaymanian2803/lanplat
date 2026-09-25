import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// The database is initialised by <AppBootstrap />, which only mounts once a visitor has
// entered the access code, so the public landing page never talks to Turso.
createRoot(document.getElementById("root")!).render(<App />);
