import assert from "node:assert/strict";
import test from "node:test";

import manifest from "@/app/manifest";

test("manifest exposes standalone home-screen metadata", () => {
  const appManifest = manifest();

  assert.equal(appManifest.display, "standalone");
  assert.equal(appManifest.start_url, "/dashboard");
  assert.equal(appManifest.short_name, "ALM");
  assert.equal(appManifest.theme_color, "#f4efe5");
  assert.ok(
    appManifest.icons?.some((icon) => icon.src === "/icon.svg"),
  );
  assert.ok(
    appManifest.icons?.some((icon) => icon.src === "/apple-icon"),
  );
});
