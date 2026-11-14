import test from "node:test";
import assert from "node:assert/strict";
import { isNewerVersion } from "../src/version.js";

test("compare les versions sémantiques", () => {
  assert.equal(isNewerVersion("1.5.0", "1.5.1"), true);
  assert.equal(isNewerVersion("1.5.0", "1.6.0"), true);
  assert.equal(isNewerVersion("1.5.0", "2.0.0"), true);
  assert.equal(isNewerVersion("1.5.0", "1.5.0"), false);
  assert.equal(isNewerVersion("1.5.1", "1.5.0"), false);
  assert.equal(isNewerVersion("v1.5.0", "v1.5.2"), true);
});
