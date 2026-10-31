import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { pool, transaction } from "./db.js";
import { migrate } from "./migrate.js";
import { hashPassword } from "./passwords.js";
import { audit } from "./admin/routes.js";
const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  await migrate();
  const name = (await input.question("Nome do proprietário: ")).trim();
  const email = (await input.question("E-mail do proprietário: "))
    .trim()
    .toLowerCase();
  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new Error("Nome ou e-mail inválido.");
  const password = randomBytes(18).toString("base64url");
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(184212)");
    if (
      (
        await c.query(
          "SELECT 1 FROM admin_accounts WHERE role='owner' AND active",
        )
      ).rowCount
    )
      throw new Error("Já existe um proprietário ativo; use o painel.");
    const a = (
      await c.query(
        "INSERT INTO admin_accounts(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id",
        [name, email, await hashPassword(password)],
      )
    ).rows[0];
    await audit(
      c,
      null,
      "bootstrap_owner",
      "account",
      a.id,
      "Criação local do primeiro proprietário",
    );
  });
  console.log(
    `Senha temporária (exibida uma única vez): ${password}\nTroque a senha no primeiro login em /admin/login.`,
  );
} finally {
  input.close();
  await pool.end();
}
