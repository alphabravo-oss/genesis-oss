import assert from "node:assert/strict";
import { test } from "node:test";
import { finishedSince, shouldRevalidateShell } from "../src/lib/revalidation.ts";
import { withSearch } from "../src/lib/cluster.ts";
import type { ShouldRevalidateFunctionArgs } from "react-router";

test("local navigation stays local; release changes and explicit refreshes reload", () => {
  const currentUrl = new URL("http://localhost/images?tag=3.33.0");
  const check = (next: string, expected: boolean) => assert.equal(shouldRevalidateShell({
    currentUrl, nextUrl: new URL(next, currentUrl), defaultShouldRevalidate: true,
  } as ShouldRevalidateFunctionArgs), expected);
  check("?tag=3.33.0&img.q=grafana", false);
  check("?tag=3.33.0&img.sort=-high", false);
  check("/packages?tag=3.33.0&pkg=grafana", false);
  check("?tag=3.33.0&profiles=argocd", false);
  check("?tag=3.33.0&follow=deployed", false);
  check("?tag=3.32.0", true);
  check("?tag=3.33.0", true);
});

test("navigation preserves ordered profiles and explicit follow mode", () => {
  const url = new URL(withSearch("/packages", "3.33.0", { profiles: "argocd,gitlab", follow: "deployed", pkg: "grafana" }), "http://localhost");
  assert.equal(url.searchParams.get("profiles"), "argocd,gitlab");
  assert.equal(url.searchParams.get("follow"), "deployed");
  assert.equal(url.searchParams.get("pkg"), "grafana");
  assert.equal(new URL(withSearch("/", "3.32.0", { profiles: "argocd" }), url).searchParams.has("follow"), false);
  const standard = new URL(withSearch("/scans", "3.33.0", { profileMode: "manual" }), url);
  assert.equal(standard.searchParams.get("profileMode"), "manual");
  assert.equal(standard.searchParams.has("profiles"), false);
});

test("completed scans refresh once, regardless of server and browser clock differences", () => {
  const old = { id: "old", finishedAt: "2099-01-01T00:00:00Z" };
  const running = { id: "new", finishedAt: "" };
  const finished = { ...running, finishedAt: "2000-01-01T00:00:00Z" };
  assert.deepEqual(finishedSince([old, running], [old, running]), []);
  assert.deepEqual(finishedSince([old, finished], [old, running]), ["new"]);
  assert.deepEqual(finishedSince([old, finished], [old, finished]), []);
});
