import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function cssRule(selector: string, source = globalsCss) {
  const rules = cssRules(selector, source);
  assert.ok(rules[0], `Expected CSS rule for ${selector}`);
  return rules[0];
}

function cssRules(selector: string, source = globalsCss) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(source.matchAll(new RegExp(`${escapedSelector}\\s*{([^}]*)}`, "g")))
    .map((match) => match[1]);
}

function mediaBlock(query: string) {
  const start = globalsCss.indexOf(`@media (${query})`);
  assert.notEqual(start, -1, `Expected media query for ${query}`);

  const openingBrace = globalsCss.indexOf("{", start);
  assert.notEqual(openingBrace, -1, `Expected media query body for ${query}`);

  let depth = 0;
  for (let index = openingBrace; index < globalsCss.length; index += 1) {
    const character = globalsCss[index];
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return globalsCss.slice(openingBrace + 1, index);
      }
    }
  }

  assert.fail(`Expected closing brace for media query ${query}`);
}

test("login page keeps the sign-in panel centered in the viewport layout", () => {
  const loginPageRule = cssRule(".login-page");
  assert.match(loginPageRule, /place-items:\s*center;/);
  assert.match(loginPageRule, /align-content:\s*center;/);
  assert.match(loginPageRule, /min-height:\s*100dvh;/);

  const loginLayoutRule = cssRule(".login-layout");
  assert.match(loginLayoutRule, /width:\s*min\(28rem,\s*100%\);/);
  assert.match(loginLayoutRule, /grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(loginLayoutRule, /grid-template-areas:\s*"panel";/);
  assert.match(loginLayoutRule, /justify-items:\s*center;/);

  assert.equal(globalsCss.includes(".login-hero"), false);
  assert.equal(globalsCss.includes(".login-layout::after"), false);
});

test("login page uses a single centered form layout on mobile", () => {
  const mobileCss = mediaBlock("max-width: 900px");
  const mobileLoginLayoutRule = cssRule(".login-layout", mobileCss);
  assert.match(mobileLoginLayoutRule, /width:\s*min\(28rem,\s*100%\);/);
  assert.match(mobileLoginLayoutRule, /grid-template-areas:\s*"panel";/);

  const mobileLoginPageRule = cssRules(".login-page", mobileCss).find((rule) =>
    /place-items:\s*center;/.test(rule),
  );
  assert.ok(mobileLoginPageRule, "Expected mobile login page centering rule");
  assert.match(mobileLoginPageRule, /place-items:\s*center;/);
  assert.match(mobileLoginPageRule, /align-content:\s*center;/);
});
