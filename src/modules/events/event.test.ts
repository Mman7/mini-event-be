import test from "node:test";
import assert from "node:assert/strict";
import { toDate } from "./event.validator.js";

test("converts a calendar date at UTC midnight", () => {
  assert.equal(toDate("2026-11-28").toISOString(), "2026-11-28T00:00:00.000Z");
});
