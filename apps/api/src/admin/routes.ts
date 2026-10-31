import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, transaction } from "../db.js";
import { config } from "../config.js";
import { hashPassword, verifyPassword } from "../passwords.js";
import { resolvedRange } from "../resolved-range.js";

interface Account {
  id: string;
  name: string;
  email: string;
  role: "owner" | "moderator";
  must_change_password: boolean;
}
const publicAccount = (a: Account) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  mustChangePassword: a.must_change_password,
});
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const fail = (statusCode: number, message: string) => {
  throw Object.assign(new Error(message), { statusCode });
};
const id = (value: unknown) => z.string().uuid().parse(value);
const reason = z.string().trim().min(3).max(1000);
const cookieName = "raiz_admin";
const token = (req: FastifyRequest) =>
  (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) || "";
function cookie(reply: FastifyReply, value: string, maxAge: number) {
  const secure =
    process.env.ADMIN_COOKIE_SECURE === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.ADMIN_COOKIE_SECURE !== "false");
  reply.header(
    "Set-Cookie",
    `${cookieName}=${value}; Path=/api/v1/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`,
  );
}
export async function audit(
  c: PoolClient,
  actor: Account | null,
  action: string,
  type: string,
  entity: string | null,
  justification: string | null = null,
  before: unknown = null,
  after: unknown = null,
) {
  await c.query(
    `INSERT INTO admin_audit_events(actor_id,actor_name,action,entity_type,entity_id,justification,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      actor?.id || null,
      actor?.name || "Bootstrap local",
      action,
      type,
      entity,
      justification,
      JSON.stringify(before),
      JSON.stringify(after),
    ],
  );
}
async function authenticated(
  req: FastifyRequest,
  allowTemporary = false,
): Promise<Account> {
  const result = await pool.query<Account>(
    `SELECT a.id,a.name,a.email,a.role,a.must_change_password FROM admin_sessions s JOIN admin_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active AND (a.locked_until IS NULL OR a.locked_until<=now())`,
    [digest(token(req))],
  );
  const account = result.rows[0];
  if (!account) return fail(401, "Sessão inválida ou expirada.");
  if (account.must_change_password && !allowTemporary)
    return fail(403, "Troque sua senha temporária para continuar.");
  return account;
}
function owner(a: Account) {
  if (a.role !== "owner") fail(403, "Acesso exclusivo do proprietário.");
}
const paging = (q: Record<string, string>) => ({
  page: Math.max(1, Math.min(100000, Number(q.page) || 1)),
  limit: Math.max(1, Math.min(100, Number(q.limit) || 25)),
});
const issueSelect = `SELECT i.id,i.category,i.description,i.verification_status AS "verificationStatus",i.lifecycle_status AS "lifecycleStatus",i.visibility,i.resolved_at AS "resolvedAt",i.created_at AS "createdAt",i.last_report_at AS "lastReportedAt",i.report_count AS "reportsCount",ST_X(i.location::geometry) AS longitude,ST_Y(i.location::geometry) AS latitude FROM issues i`;

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/api/v1/admin")) return;
    reply.header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        !req.headers.origin ||
        !config.allowedOrigins.includes(req.headers.origin)
      )
        fail(403, "Origem da requisição não permitida.");
    }
  });
  app.post("/api/v1/admin/login", async (req, reply) => {
    const { email, password } = z
      .object({
        email: z
          .string()
          .email()
          .max(254)
          .transform((v) => v.trim().toLowerCase()),
        password: z.string().max(1024),
      })
      .parse(req.body);
    const result = await transaction(async (c) => {
      const a = (
        await c.query(
          `SELECT * FROM admin_accounts WHERE email=$1 FOR UPDATE`,
          [email],
        )
      ).rows[0];
      if (
        !a ||
        !a.active ||
        (a.locked_until && new Date(a.locked_until) > new Date())
      )
        return null;
      if (!(await verifyPassword(password, a.password_hash))) {
        await c.query(
          `UPDATE admin_accounts SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=$1`,
          [a.id],
        );
        return null;
      }
      await c.query(
        "UPDATE admin_accounts SET failed_attempts=0,locked_until=NULL WHERE id=$1",
        [a.id],
      );
      await c.query("DELETE FROM admin_sessions WHERE expires_at<=now()");
      const session = randomBytes(32).toString("hex");
      await c.query(
        `INSERT INTO admin_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '8 hours')`,
        [digest(session), a.id],
      );
      await audit(c, a, "login", "auth", a.id);
      return { a, session };
    });
    if (!result)
      return fail(
        401,
        "Credenciais inválidas ou conta temporariamente indisponível.",
      );
    cookie(reply, result.session, 28800);
    return { account: publicAccount(result.a) };
  });
  app.get("/api/v1/admin/session", async (req) => ({
    account: publicAccount(await authenticated(req, true)),
  }));
  app.post("/api/v1/admin/logout", async (req, reply) => {
    const a = await authenticated(req, true);
    await transaction(async (c) => {
      await c.query("DELETE FROM admin_sessions WHERE token_hash=$1", [
        digest(token(req)),
      ]);
      await audit(c, a, "logout", "auth", a.id);
    });
    cookie(reply, "", 0);
    return { ok: true };
  });
  app.post("/api/v1/admin/password", async (req, reply) => {
    const a = await authenticated(req, true);
    const { currentPassword, password } = z
      .object({
        currentPassword: z.string().max(1024),
        password: z.string().min(12).max(1024),
      })
      .parse(req.body);
    await transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT password_hash FROM admin_accounts WHERE id=$1 FOR UPDATE",
          [a.id],
        )
      ).rows[0];
      if (!(await verifyPassword(currentPassword, row.password_hash)))
        fail(401, "Senha atual inválida.");
      if (currentPassword === password)
        fail(400, "Escolha uma senha diferente.");
      await c.query(
        "UPDATE admin_accounts SET password_hash=$2,must_change_password=false WHERE id=$1",
        [a.id, await hashPassword(password)],
      );
      await c.query("DELETE FROM admin_sessions WHERE account_id=$1", [a.id]);
      await audit(c, a, "password_changed", "auth", a.id);
    });
    cookie(reply, "", 0);
    return { ok: true };
  });
  app.get("/api/v1/admin/accounts", async (req) => {
    owner(await authenticated(req));
    return {
      accounts: (
        await pool.query(
          'SELECT id,name,email,role,active,must_change_password AS "mustChangePassword",created_at AS "createdAt" FROM admin_accounts ORDER BY created_at DESC',
        )
      ).rows,
    };
  });
  app.post("/api/v1/admin/accounts", async (req, reply) => {
    const a = await authenticated(req);
    owner(a);
    const body = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        role: z.enum(["owner", "moderator"]),
        justification: reason,
      })
      .parse(req.body);
    const temporaryPassword = randomBytes(18).toString("base64url");
    const created = await transaction(async (c) => {
      const row = (
        await c.query(
          `INSERT INTO admin_accounts(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role`,
          [
            body.name,
            body.email,
            await hashPassword(temporaryPassword),
            body.role,
          ],
        )
      ).rows[0];
      await audit(
        c,
        a,
        "account_created",
        "account",
        row.id,
        body.justification,
        null,
        row,
      );
      return row;
    });
    return reply.code(201).send({ account: created, temporaryPassword });
  });
  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/accounts/:id/reset-password",
    async (req) => {
      const a = await authenticated(req);
      owner(a);
      const target = id(req.params.id);
      const body = z.object({ justification: reason }).parse(req.body);
      const temporaryPassword = randomBytes(18).toString("base64url");
      await transaction(async (c) => {
        const r = await c.query(
          "UPDATE admin_accounts SET password_hash=$2,must_change_password=true,failed_attempts=0,locked_until=NULL WHERE id=$1 RETURNING id",
          [target, await hashPassword(temporaryPassword)],
        );
        if (!r.rowCount) fail(404, "Conta não encontrada.");
        await c.query("DELETE FROM admin_sessions WHERE account_id=$1", [
          target,
        ]);
        await audit(
          c,
          a,
          "password_reset",
          "account",
          target,
          body.justification,
        );
      });
      return { temporaryPassword };
    },
  );
  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/accounts/:id",
    async (req) => {
      const a = await authenticated(req);
      owner(a);
      const target = id(req.params.id);
      const body = z
        .object({ active: z.boolean(), justification: reason })
        .parse(req.body);
      await transaction(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(184212)");
        const old = (
          await c.query(
            "SELECT id,active,role FROM admin_accounts WHERE id=$1 FOR UPDATE",
            [target],
          )
        ).rows[0];
        if (!old) fail(404, "Conta não encontrada.");
        if (old.active === body.active)
          fail(409, "A conta já está neste estado.");
        if (
          old.role === "owner" &&
          !body.active &&
          Number(
            (
              await c.query(
                "SELECT count(*) FROM admin_accounts WHERE role='owner' AND active",
              )
            ).rows[0].count,
          ) <= 1
        )
          fail(409, "Não é possível desativar o último proprietário.");
        await c.query("UPDATE admin_accounts SET active=$2 WHERE id=$1", [
          target,
          body.active,
        ]);
        await c.query("DELETE FROM admin_sessions WHERE account_id=$1", [
          target,
        ]);
        await audit(
          c,
          a,
          body.active ? "account_activated" : "account_disabled",
          "account",
          target,
          body.justification,
          { active: old.active },
          { active: body.active },
        );
      });
      return { ok: true };
    },
  );
  app.get<{ Querystring: Record<string, string> }>(
    "/api/v1/admin/history",
    async (req) => {
      const a = await authenticated(req);
      const { page, limit } = paging(req.query);
      return {
        events: (
          await pool.query(
            `SELECT *,count(*) OVER() AS total FROM admin_audit_events WHERE ($1 OR entity_type='issue') ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
            [a.role === "owner", limit, (page - 1) * limit],
          )
        ).rows,
        page,
        limit,
      };
    },
  );
  app.get<{ Querystring: Record<string, string> }>(
    "/api/v1/admin/issues",
    async (req) => {
      await authenticated(req);
      const q = req.query;
      const range = resolvedRange(q);
      const { page, limit } = paging(q);
      for (const [field, values] of Object.entries({
        category: ["lixo", "esgoto", "queimada", "desmatamento", "agua", "ar"],
        verificationStatus: ["unverified", "corroborated", "verified"],
        visibility: ["visible", "hidden"],
        lifecycleStatus: ["active", "resolved"],
      }))
        if (q[field] && !values.includes(q[field]!))
          fail(400, "Filtro inválido.");
      const where = ` WHERE ($1::text IS NULL OR i.category=$1) AND ($2::text IS NULL OR i.verification_status=$2) AND ($3::text IS NULL OR i.visibility=$3) AND ($4::text IS NULL OR i.lifecycle_status=$4)
      AND (i.lifecycle_status='active' OR ($5::text IS NOT NULL AND i.resolved_at >= ($5::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND i.resolved_at < (($6::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')))
      AND ($7::text='' OR i.id::text=$7 OR COALESCE(i.description,'') ILIKE '%' || $7 || '%')`;
      const values = [
        q.category || null,
        q.verificationStatus || null,
        q.visibility || null,
        q.lifecycleStatus || null,
        range?.from || null,
        range?.to || null,
        (q.search || "").slice(0, 200),
      ];
      const total = Number(
        (await pool.query("SELECT count(*) FROM issues i" + where, values))
          .rows[0].count,
      );
      return {
        issues: (
          await pool.query(
            issueSelect +
              where +
              " ORDER BY i.last_report_at DESC,i.id DESC LIMIT $8 OFFSET $9",
            [...values, limit, (page - 1) * limit],
          )
        ).rows,
        total,
        page,
        limit,
      };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/issues/:id",
    async (req) => {
      await authenticated(req);
      const target = id(req.params.id);
      const issue = (await pool.query(issueSelect + " WHERE i.id=$1", [target]))
        .rows[0];
      if (!issue) fail(404, "Ocorrência não encontrada.");
      const reports = (
        await pool.query(
          `SELECT id,kind,description,created_at AS "createdAt",CASE WHEN image_id IS NULL THEN NULL ELSE '/api/v1/admin/media/'||image_id END AS "imageUrl" FROM reports WHERE issue_id=$1 ORDER BY created_at DESC,id DESC`,
          [target],
        )
      ).rows;
      const signals = (
        await pool.query(
          `SELECT count(*)::int AS "totalReports",count(DISTINCT ip_hash)::int AS "distinctSources",count(image_id)::int AS "withPhoto",min(created_at) AS "firstReportedAt",max(created_at) AS "lastReportedAt",(count(*)>=4 AND (SELECT max(n) FROM (SELECT count(*) n FROM reports WHERE issue_id=$1 GROUP BY ip_hash) x)>count(*)/2.0) AS "possibleAbuse" FROM reports WHERE issue_id=$1`,
          [target],
        )
      ).rows[0];
      const history = (
        await pool.query(
          "SELECT * FROM admin_audit_events WHERE entity_type='issue' AND entity_id=$1 ORDER BY created_at DESC,id DESC",
          [target],
        )
      ).rows;
      return { issue, reports, signals, history };
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/issues/:id/actions",
    async (req) => {
      const a = await authenticated(req);
      const target = id(req.params.id);
      const body = z
        .object({
          action: z.enum([
            "verify",
            "unverify",
            "resolve",
            "reopen",
            "hide",
            "restore",
          ]),
          justification: reason,
        })
        .parse(req.body);
      await transaction(async (c) => {
        const before = (
          await c.query(
            "SELECT verification_status,lifecycle_status,visibility,resolved_at FROM issues WHERE id=$1 FOR UPDATE",
            [target],
          )
        ).rows[0];
        if (!before) fail(404, "Ocorrência não encontrada.");
        const after = { ...before };
        switch (body.action) {
          case "verify":
            if (before.verification_status === "verified")
              fail(409, "Ocorrência já verificada.");
            after.verification_status = "verified";
            break;
          case "unverify":
            if (before.verification_status !== "verified")
              fail(409, "Ocorrência não está verificada.");
            after.verification_status =
              Number(
                (
                  await c.query(
                    "SELECT count(DISTINCT ip_hash) FROM reports WHERE issue_id=$1",
                    [target],
                  )
                ).rows[0].count,
              ) >= 3
                ? "corroborated"
                : "unverified";
            break;
          case "resolve":
            if (before.lifecycle_status === "resolved")
              fail(409, "Ocorrência já resolvida.");
            after.lifecycle_status = "resolved";
            after.resolved_at = new Date();
            break;
          case "reopen":
            if (before.lifecycle_status === "active")
              fail(409, "Ocorrência já ativa.");
            after.lifecycle_status = "active";
            after.resolved_at = null;
            break;
          case "hide":
            if (before.visibility === "hidden")
              fail(409, "Ocorrência já oculta.");
            after.visibility = "hidden";
            break;
          case "restore":
            if (before.visibility === "visible")
              fail(409, "Ocorrência já visível.");
            after.visibility = "visible";
            break;
        }
        await c.query(
          "UPDATE issues SET verification_status=$2,lifecycle_status=$3,visibility=$4,resolved_at=$5 WHERE id=$1",
          [
            target,
            after.verification_status,
            after.lifecycle_status,
            after.visibility,
            after.resolved_at,
          ],
        );
        await audit(
          c,
          a,
          body.action,
          "issue",
          target,
          body.justification,
          before,
          after,
        );
      });
      return { ok: true };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/media/:id",
    async (req, reply) => {
      await authenticated(req);
      const row = (
        await pool.query("SELECT object_key FROM media_files WHERE id=$1", [
          id(req.params.id),
        ])
      ).rows[0];
      if (!row) fail(404, "Imagem não encontrada.");
      try {
        return reply
          .type("image/jpeg")
          .header("X-Content-Type-Options", "nosniff")
          .send(await readFile(join(config.storageDir, row.object_key)));
      } catch {
        return fail(404, "Imagem não encontrada.");
      }
    },
  );
}
