import { defineHandler } from "nitro";
import { getRequestHeaders, getRequestURL, readRawBody } from "nitro/h3";

const authBaseUrl = process.env.NEON_AUTH_BASE_URL!;
const forwardedRequestHeaders = new Set([
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "user-agent",
  "x-forwarded-for",
]);

export default defineHandler(async (event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;
  const upstreamPath = pathname.startsWith("/api/auth")
    ? pathname.slice("/api/auth".length) || "/"
    : pathname;
  const upstreamUrl = `${authBaseUrl}${upstreamPath}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    const name = key.toLowerCase();
    if (value && forwardedRequestHeaders.has(name)) headers.set(name, value);
  }

  const cookie = headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie.replaceAll("__Secure_", "__Secure-").replaceAll("__Host_", "__Host-"));
  }

  const body = event.method === "GET" || event.method === "HEAD"
    ? undefined
    : await readRawBody(event, false);
  const upstream = await fetch(upstreamUrl, {
    method: event.method,
    headers,
    body: body ?? undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") responseHeaders.set(key, value);
  });

  const cookies = upstream.headers.getSetCookie?.() ?? [];
  for (let item of cookies) {
    if (url.protocol === "http:") {
      item = item
        .replaceAll("__Secure-", "__Secure_")
        .replaceAll("__Host-", "__Host_")
        .replaceAll("; Secure", "")
        .replaceAll(";Secure", "")
        .replaceAll("; Partitioned", "")
        .replaceAll(";Partitioned", "")
        .replace(/;[ ]*Domain=[^;]*/gi, "")
        .replaceAll("; SameSite=None", "; SameSite=Lax")
        .replaceAll(";SameSite=None", "; SameSite=Lax");
    }
    responseHeaders.append("set-cookie", item);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
});
