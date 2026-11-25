import test from "node:test";
import assert from "node:assert/strict";
import { registrationSchema } from "./registration.validator.js";

test("accepts an empty registration body", () => {
  assert.deepEqual(registrationSchema.parse({}), {});
});

test("rejects identity fields in the registration body", () => {
  assert.throws(() =>
    registrationSchema.parse({
      name: "John",
      email: "john@example.com",
    }),
  );
});
