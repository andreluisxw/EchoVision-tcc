import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./passwords.js";

test("senhas usam salt distinto e verificam somente a credencial correta", async () => {
  const first = await hashPassword("senha-segura-123");
  const second = await hashPassword("senha-segura-123");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("senha-segura-123", first), true);
  assert.equal(await verifyPassword("senha-incorreta", first), false);
});

test("rejeita senha curta e hash malformado", async () => {
  await assert.rejects(() => hashPassword("curta"));
  assert.equal(await verifyPassword("senha-segura-123", "invalido"), false);
  assert.equal(
    await verifyPassword("senha-segura-123", "scrypt$999999999$8$1$aa$bb"),
    false,
  );
});
