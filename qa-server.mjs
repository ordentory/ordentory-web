import http from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = (process.env.ORDENTORY_QA_API_ORIGIN || "").replace(/\/$/, "");
if (!apiOrigin.startsWith("https://") || !URL.canParse(apiOrigin) ||
    new URL(apiOrigin).hostname === "api.ordentory.kr") {
  throw new Error("An isolated HTTPS ORDENTORY_QA_API_ORIGIN is required");
}
const allowed = new Set(["/", "/checkout.html", "/payment-success.html", "/payment-fail.html", "/qa-config.js"]);
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405); response.end(); return;
  }
  if (!allowed.has(pathname)) {
    response.writeHead(404); response.end("Not found"); return;
  }
  if (pathname === "/qa-config.js") {
    response.writeHead(200, {"Content-Type": "application/javascript; charset=utf-8"});
    response.end("window.ORDENTORY_QA_API_ORIGIN = " + JSON.stringify(apiOrigin) + ";");
    return;
  }
  const filename = pathname === "/" ? "checkout.html" : pathname.slice(1);
  try {
    const contents = await readFile(path.join(root, filename));
    response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
});
server.listen(Number(process.env.PORT || 3000), "0.0.0.0");
