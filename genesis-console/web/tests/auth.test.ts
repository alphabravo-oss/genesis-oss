import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnTo } from "../src/lib/auth.ts";

test("login preserves local deep links and rejects external or looping redirects", () => {
  assert.equal(safeReturnTo("/packages?tag=3.33.0&pkg=grafana#details"), "/packages?tag=3.33.0&pkg=grafana#details");
  for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/\nevil.test", "/login", "/foo/../login", "/auth/login"]) assert.equal(safeReturnTo(value), "/");
});
