import { copyFileSync } from "node:fs";

copyFileSync("vercel.json", "dist/vercel.json");
