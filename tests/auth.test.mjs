import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/auth.ts";

test("hashPassword and verifyPassword work correctly with PBKDF2", async () => {
  const password = "ShopkeeperPassword2026!";
  const hash = await hashPassword(password);

  assert.ok(hash.includes(":"));
  const [salt, derived] = hash.split(":");
  assert.equal(salt.length, 32); // 16 bytes in hex
  assert.equal(derived.length, 64); // 32 bytes (256 bits) in hex

  const isValid = await verifyPassword(password, hash);
  assert.equal(isValid, true);

  const isInvalid = await verifyPassword("WrongPassword123", hash);
  assert.equal(isInvalid, false);
});
