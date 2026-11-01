import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const standalone = new URL(".next/standalone/", root);
if (!existsSync(new URL("server.js", standalone))) {
  throw new Error("Avval npm run build buyrug‘ini bajaring.");
}
cpSync(new URL(".next/static/", root), new URL(".next/static/", standalone), { recursive: true });
cpSync(new URL("public/", root), new URL("public/", standalone), { recursive: true });
process.env.HOSTNAME = process.env.FRONTEND_HOST || "127.0.0.1";
process.chdir(fileURLToPath(standalone));
await import(new URL("server.js", standalone).href);
