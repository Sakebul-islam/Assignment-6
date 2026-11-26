// Vercel entry: serves the app bundled by `npm run build` (tsup).
// Importing express here is what lets Vercel detect this file as the Express entry.
import "express";

export { default } from "./dist/server.js";
