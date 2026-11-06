import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./server.js";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { hashPassword } from "./passwords.js";

test(
  "fluxo administrativo integrado",
  { skip: process.env.ADMIN_INTEGRATION !== "true" },
  async () => {
    await migrate();
    await migrate();
    const app = await buildApp();
    const email = `test-${Date.now()}@example.test`;
    const account = (
      await pool.query(
        `INSERT INTO admin_accounts(name,email,password_hash,role,must_change_password)
    VALUES('Teste',$1,$2,'owner',false) RETURNING id`,
        [email, await hashPassword("senha-teste-12345")],
      )
    ).rows[0];
    const origin = { origin: "http://localhost:8080" };
    try {
      assert.equal(
        (await app.inject({ url: "/api/v1/admin/accounts" })).statusCode,
        401,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/admin/login",
            headers: origin,
            payload: { email, password: "errada" },
          })
        ).statusCode,
        401,
      );
      const login = await app.inject({
        method: "POST",
        url: "/api/v1/admin/login",
        headers: origin,
        payload: { email, password: "senha-teste-12345" },
      });
      assert.equal(login.statusCode, 200, login.body);
      const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
      const headers = { ...origin, cookie };
      assert.equal(
        (await app.inject({ url: "/api/v1/admin/session", headers }))
          .statusCode,
        200,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/admin/accounts",
            headers: { cookie },
            payload: {},
          })
        ).statusCode,
        403,
      );
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/admin/accounts",
        headers,
        payload: {
          name: "Moderador de teste",
          email: `mod-${Date.now()}@example.test`,
          role: "moderator",
          justification: "Criar conta para teste",
        },
      });
      assert.equal(created.statusCode, 201, created.body);
      const mod = created.json();
      const modLogin = await app.inject({
        method: "POST",
        url: "/api/v1/admin/login",
        headers: origin,
        payload: { email: mod.account.email, password: mod.temporaryPassword },
      });
      const modHeaders = {
        ...origin,
        cookie: String(modLogin.headers["set-cookie"]).split(";")[0]!,
      };
      assert.equal(
        (await app.inject({ url: "/api/v1/admin/issues", headers: modHeaders }))
          .statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/admin/password",
            headers: modHeaders,
            payload: {
              currentPassword: mod.temporaryPassword,
              password: "senha-nova-mod-12345",
            },
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/admin/session",
            headers: modHeaders,
          })
        ).statusCode,
        401,
      );
      const changed = await app.inject({
        method: "POST",
        url: "/api/v1/admin/login",
        headers: origin,
        payload: { email: mod.account.email, password: "senha-nova-mod-12345" },
      });
      modHeaders.cookie = String(changed.headers["set-cookie"]).split(";")[0]!;
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/admin/accounts",
            headers: modHeaders,
          })
        ).statusCode,
        403,
      );
      const history = await app.inject({
        url: "/api/v1/admin/history",
        headers: modHeaders,
      });
      assert.equal(history.statusCode, 200);
      assert.ok(
        history
          .json()
          .events.every(
            (e: { entity_type: string }) => e.entity_type === "issue",
          ),
      );
      const duplicate = await app.inject({
        method: "POST",
        url: "/api/v1/admin/accounts",
        headers,
        payload: {
          name: "Duplicado",
          email: mod.account.email.toUpperCase(),
          role: "moderator",
          justification: "Testar unicidade",
        },
      });
      assert.equal(duplicate.statusCode, 409);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/v1/admin/accounts/${mod.account.id}/reset-password`,
            headers,
            payload: { justification: "Testar redefinição" },
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/admin/session",
            headers: modHeaders,
          })
        ).statusCode,
        401,
      );
      assert.equal(
        (
          await app.inject({
            method: "PATCH",
            url: `/api/v1/admin/accounts/${mod.account.id}`,
            headers,
            payload: { active: false, justification: "Teste de revogação" },
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/admin/session",
            headers: modHeaders,
          })
        ).statusCode,
        401,
      );
      const issue = (
        await pool.query(
          `INSERT INTO issues(category,description,location) VALUES('lixo','Teste administrativo',ST_SetSRID(ST_MakePoint(-46,-23),4326)::geography) RETURNING id`,
        )
      ).rows[0];
      const action = (value: string) =>
        app.inject({
          method: "POST",
          url: `/api/v1/admin/issues/${issue.id}/actions`,
          headers,
          payload: {
            action: value,
            justification: "Validação técnica automatizada",
          },
        });
      await pool.query(
        "INSERT INTO reports(issue_id,ip_hash,kind) VALUES($1,$2,'initial')",
        [issue.id, "a".repeat(64)],
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/v1/admin/issues/${issue.id}/actions`,
            headers,
            payload: { action: "resolve", justification: "" },
          })
        ).statusCode,
        400,
      );
      assert.equal((await action("verify")).statusCode, 200);
      assert.equal((await action("unverify")).statusCode, 200);
      assert.equal((await action("resolve")).statusCode, 200);
      const range = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const publicList = await app.inject({
        url: `/api/v1/issues?bbox=-47,-24,-45,-22&includeResolved=true&resolvedFrom=${range}&resolvedTo=${range}`,
      });
      assert.equal(publicList.statusCode, 200, publicList.body);
      assert.ok(
        publicList
          .json()
          .features.some((f: { id: string }) => f.id === issue.id),
      );
      const activeList = await app.inject({
        url: "/api/v1/issues?bbox=-47,-24,-45,-22",
      });
      assert.ok(
        !activeList
          .json()
          .features.some((f: { id: string }) => f.id === issue.id),
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/v1/issues/${issue.id}/confirmations`,
            payload: {},
          })
        ).statusCode,
        409,
      );
      assert.equal((await action("resolve")).statusCode, 409);
      assert.equal((await action("reopen")).statusCode, 200);
      assert.equal((await action("hide")).statusCode, 200);
      const mediaId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO media_files(id,object_key,width,height) VALUES($1,$2,1,1)",
        [mediaId, "fixture-inexistente.jpg"],
      );
      await pool.query("UPDATE reports SET image_id=$2 WHERE issue_id=$1", [
        issue.id,
        mediaId,
      ]);
      assert.equal(
        (await app.inject({ url: `/api/v1/media/${mediaId}` })).statusCode,
        404,
      );
      assert.equal(
        (await app.inject({ url: `/api/v1/admin/media/${mediaId}` }))
          .statusCode,
        401,
      );
      assert.equal(
        (await app.inject({ url: `/api/v1/issues/${issue.id}` })).statusCode,
        404,
      );
      assert.equal((await action("restore")).statusCode, 200);
      const detail = await app.inject({
        url: `/api/v1/admin/issues/${issue.id}`,
        headers,
      });
      assert.equal(detail.statusCode, 200, detail.body);
      assert.equal(detail.body.includes("ip_hash"), false);
      const events = await pool.query(
        "SELECT * FROM admin_audit_events WHERE entity_id=$1",
        [issue.id],
      );
      assert.equal(events.rowCount, 6);
      const concurrent = await Promise.all([
        action("resolve"),
        action("resolve"),
      ]);
      assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [200, 409]);
      assert.equal(
        Number(
          (
            await pool.query("SELECT count(*) FROM reports WHERE issue_id=$1", [
              issue.id,
            ])
          ).rows[0].count,
        ),
        1,
      );
      await pool.query(
        "UPDATE issues SET resolved_at='2026-11-09T02:59:59Z' WHERE id=$1",
        [issue.id],
      );
      const dayUrl =
        "/api/v1/issues?bbox=-47,-24,-45,-22&includeResolved=true&resolvedFrom=2026-11-09&resolvedTo=2026-11-09";
      assert.ok(
        !(await app.inject({ url: dayUrl }))
          .json()
          .features.some((f: { id: string }) => f.id === issue.id),
      );
      await pool.query(
        "UPDATE issues SET resolved_at='2026-11-09T03:00:00Z' WHERE id=$1",
        [issue.id],
      );
      assert.ok(
        (await app.inject({ url: dayUrl }))
          .json()
          .features.some((f: { id: string }) => f.id === issue.id),
      );
      for (let i = 0; i < 5; i++)
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/login",
          headers: origin,
          payload: { email, password: "errada" },
        });
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/admin/login",
            headers: origin,
            payload: { email, password: "senha-teste-12345" },
          })
        ).statusCode,
        401,
      );
      await pool.query(
        "UPDATE admin_accounts SET locked_until=now()-interval '1 minute' WHERE id=$1",
        [account.id],
      );
      await assert.rejects(
        pool.query(
          "UPDATE admin_audit_events SET action=$1 WHERE entity_id=$2",
          ["alterado", issue.id],
        ),
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/admin/logout",
            headers,
            payload: {},
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (await app.inject({ url: "/api/v1/admin/session", headers }))
          .statusCode,
        401,
      );
      await pool.query("DELETE FROM issues WHERE id=$1", [issue.id]);
      await pool.query("DELETE FROM media_files WHERE id=$1", [mediaId]);
    } finally {
      await pool.query("DELETE FROM admin_sessions WHERE account_id=$1", [
        account.id,
      ]);
      await pool.query("UPDATE admin_accounts SET active=false WHERE id=$1", [
        account.id,
      ]);
      await app.close();
      await pool.end();
    }
  },
);
