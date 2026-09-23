import assert from "node:assert/strict";
import { test } from "node:test";
import { sameInput, sourceLabel } from "../src/lib/connection.ts";

test("the header names the saved connection, or says where the cluster comes from", () => {
  assert.equal(sourceLabel({ name: "prod-east", source: "saved" }, "k3d-genesis"), "prod-east");
  assert.equal(sourceLabel({ name: "", source: "environment" }, "k3d-genesis"), "k3d-genesis · set by deployment");
  assert.equal(sourceLabel({ name: "", source: "in-cluster" }, ""), "In-cluster service account");
  assert.equal(sourceLabel({ name: "", source: "none" }, ""), "Not connected");
  assert.equal(sourceLabel(undefined, "ctx"), "ctx");
});

test("saving needs a fresh test after any input change", () => {
  const base = { name: "prod", kubeconfig: "a", context: "", rewrite: false };
  assert.equal(sameInput(base, { ...base }), true);
  assert.equal(sameInput(base, { ...base, name: " prod " }), true);
  for (const change of [{ name: "dev" }, { kubeconfig: "b" }, { context: "other" }, { rewrite: true }]) {
    assert.equal(sameInput(base, { ...base, ...change }), false);
  }
});
