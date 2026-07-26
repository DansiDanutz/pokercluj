import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, vercel] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../vercel.json", import.meta.url), "utf8").then(JSON.parse),
]);

assert.match(html, /<html\s+lang="ro">/, "document language must be Romanian");
assert.match(html, /<a class="skip-link" href="#main-content">/, "a skip link must target the main content");
assert.match(html, /<main id="main-content" tabindex="-1">/, "the page must expose a focusable main landmark");
assert.equal((html.match(/<main\b/g) ?? []).length, 1, "the page must contain exactly one main landmark");

const siteHeaders = vercel.headers?.find(({ source }) => source === "/(.*)")?.headers ?? [];
const headers = new Map(siteHeaders.map(({ key, value }) => [key.toLowerCase(), value]));
for (const name of [
  "content-security-policy",
  "permissions-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-frame-options",
]) {
  assert(headers.has(name), `missing deployment header: ${name}`);
}

const csp = headers.get("content-security-policy");
for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "script-src 'none'"]) {
  assert(csp.includes(directive), `CSP must contain: ${directive}`);
}

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const [token, background] of [
  ["text-light", "#f8f9fa"],
  ["accent", "#ffffff"],
  ["danger", "#fff5f5"],
]) {
  const color = css.match(new RegExp(`--${token}:\\s*(#[\\da-f]{6})`, "i"))?.[1];
  assert(color, `--${token} must use an explicit six-digit color`);
  assert(contrast(color, background) >= 4.5, `--${token} text must meet WCAG AA on ${background}`);
}

console.log("Site verification passed: semantics, security headers, and text contrast.");
