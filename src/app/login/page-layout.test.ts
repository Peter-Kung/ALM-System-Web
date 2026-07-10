import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

test("login page keeps the sign-in panel centered in the viewport layout", () => {
  assert.match(
    globalsCss,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(21rem,\s*28rem\)\s+minmax\(0,\s*1fr\);/,
  );
  assert.match(globalsCss, /grid-template-areas:\s*"hero panel spacer";/);
  assert.match(globalsCss, /\.login-layout::after\s*{[\s\S]*grid-area:\s*spacer;/);
  assert.match(globalsCss, /\.login-page\s*{[\s\S]*min-height:\s*100dvh;/);
});

test("login page uses a single centered form layout on mobile", () => {
  assert.match(
    globalsCss,
    /@media \(max-width:\s*900px\)[\s\S]*\.login-layout\s*{[\s\S]*grid-template-areas:\s*"panel";/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width:\s*900px\)[\s\S]*\.login-page\s*{[\s\S]*place-items:\s*center;[\s\S]*align-content:\s*center;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width:\s*900px\)[\s\S]*\.login-layout::after,[\s\S]*\.login-hero\s*{[\s\S]*display:\s*none;/,
  );
});
