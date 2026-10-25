import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { z } from "zod";
import {
  CATEGORIES,
  type CategoryId,
  type Issue,
  type IssueGeoJson,
} from "@eco/shared";
import { config } from "./config.js";
import { pool, transaction } from "./db.js";
import {
  SlidingWindowLimiter,
  RateLimitError,
  type LimitRule,
} from "./limiter.js";
import { storeImage, type StoredImage } from "./media.js";
import { hashIp } from "./security.js";
import { adminRoutes } from "./admin/routes.js";
import { migrate } from "./migrate.js";
import { resolvedRange } from "./resolved-range.js";
import { pathToFileURL } from "node:url";

class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as string[];
const reportSchema = z.object({
  category: z
    .string()
    .refine(
      (value): value is CategoryId => CATEGORY_IDS.includes(value),
      "Categoria inválida",
    ),
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  description: z.string().trim().max(500).optional().default(""),
});
const coordinateSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  category: z
    .string()
    .refine((value): value is CategoryId => CATEGORY_IDS.includes(value)),
});
const uuidSchema = z.string().uuid();

interface IssueRow {
  id: string;
  category: CategoryId;
  description: string | null;
  longitude: number;
  latitude: number;
  reportsCount: number;
  createdAt: Date;
  lastReportedAt: Date;
  verificationStatus: Issue["verificationStatus"];
  lifecycleStatus: Issue["lifecycleStatus"];
  imageId: string | null;
  resolvedAt: Date | null;
}

const ISSUE_SELECT = `
  SELECT i.id, i.category, i.description,
    ST_X(i.location::geometry)::float8 AS "longitude",
    ST_Y(i.location::geometry)::float8 AS "latitude",
    i.report_count AS "reportsCount", i.created_at AS "createdAt",
    i.last_report_at AS "lastReportedAt", i.verification_status AS "verificationStatus",
    i.lifecycle_status AS "lifecycleStatus", i.resolved_at AS "resolvedAt",
    (SELECT image_id FROM reports r WHERE r.issue_id=i.id AND r.image_id IS NOT NULL
     ORDER BY r.created_at ASC LIMIT 1) AS "imageId"
  FROM issues i
`;

function toIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    category: row.category,
    longitude: Number(row.longitude),
    latitude: Number(row.latitude),
    description: row.description,
    reportsCount: row.reportsCount,
    createdAt: row.createdAt.toISOString(),
    lastReportedAt: row.lastReportedAt.toISOString(),
    verificationStatus: row.verificationStatus,
    lifecycleStatus: row.lifecycleStatus,
    imageUrl: row.imageId ? `/api/v1/media/${row.imageId}` : null,
    resolvedAt: row.resolvedAt?.toISOString() || null,
  };
}

async function findIssue(
  id: string,
  includeHidden = false,
): Promise<Issue | null> {
  const result = await pool.query<IssueRow>(
    `${ISSUE_SELECT} WHERE i.id=$1 ${includeHidden ? "" : "AND i.visibility='visible'"}`,
    [id],
  );
  return result.rows[0] ? toIssue(result.rows[0]) : null;
}

function requireUuid(id: string): string {
  const result = uuidSchema.safeParse(id);
  if (!result.success)
    throw new HttpError(400, "INVALID_ID", "Identificador inválido.");
  return result.data;
}

const limiter = new SlidingWindowLimiter();
const oneHour = 3_600_000;
const oneDay = 86_400_000;
const postRules: LimitRule[] = [
  { scope: "post-hour", max: config.maxPostsHour, windowMs: oneHour },
  { scope: "post-day", max: config.maxPostsDay, windowMs: oneDay },
];
const confirmRules: LimitRule[] = [
  { scope: "confirm-day", max: config.maxConfirmsDay, windowMs: oneDay },
];

export async function buildApp() {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-forwarded-for",
      ],
      serializers: {
        req: (req) => ({
          method: req.method,
          path: req.url?.split("?")[0],
          requestId: req.id,
        }),
      },
    },
    trustProxy: config.trustedProxies.length ? config.trustedProxies : false,
    bodyLimit: config.maxImageBytes + 200_000,
  });

  await app.register(cors, {
    origin: (origin, callback) =>
      callback(null, !origin || config.allowedOrigins.includes(origin)),
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: config.maxImageBytes, files: 1, fields: 5, parts: 6 },
    throwFileSizeLimit: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({
          error: "INVALID_INPUT",
          message: "Confira os dados informados.",
        });
    if ((error as { code?: string }).code === "23505")
      return reply
        .code(409)
        .send({
          error: "DUPLICATE",
          message: "Já existe uma conta com este e-mail.",
        });
    if (error instanceof RateLimitError) {
      return reply
        .code(429)
        .header("Retry-After", String(error.retryAfterSeconds))
        .send({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Limite temporário atingido. Tente novamente mais tarde.",
          retryAfter: error.retryAfterSeconds,
        });
    }
    if (error instanceof HttpError) {
      return reply
        .code(error.statusCode)
        .send({ error: error.errorCode, message: error.message });
    }
    const status =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    if (status >= 500) request.log.error(error);
    const code =
      status === 413
        ? "PHOTO_TOO_LARGE"
        : status === 400
          ? "BAD_REQUEST"
          : "INTERNAL_ERROR";
    return reply.code(status >= 400 ? status : 500).send({
      error: code,
      message:
        status >= 400 &&
        status < 500 &&
        status !== 413 &&
        error instanceof Error
          ? error.message
          : status === 413
            ? "A imagem excede o tamanho permitido."
            : status === 400
              ? "Requisição inválida."
              : "Não foi possível processar a operação.",
    });
  });

  await adminRoutes(app);

  app.get("/api/v1/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok" };
  });

  app.get("/api/v1/categories", async () => ({ categories: CATEGORIES }));

  app.get(
    "/api/v1/issues",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>,
    ) => {
      const range = resolvedRange(request.query);
      const raw = (request.query.bbox || "").split(",").map(Number);
      if (raw.length !== 4 || raw.some((n) => !Number.isFinite(n))) {
        throw new HttpError(
          400,
          "INVALID_BBOX",
          "Informe bbox=minLng,minLat,maxLng,maxLat.",
        );
      }
      const [minLng, minLat, maxLng, maxLat] = raw as [
        number,
        number,
        number,
        number,
      ];
      if (
        minLng < -180 ||
        maxLng > 180 ||
        minLat < -90 ||
        maxLat > 90 ||
        minLng >= maxLng ||
        minLat >= maxLat
      ) {
        throw new HttpError(400, "INVALID_BBOX", "Área geográfica inválida.");
      }
      const category = request.query.category || null;
      if (category && !CATEGORY_IDS.includes(category))
        throw new HttpError(400, "INVALID_CATEGORY", "Categoria inválida.");
      const result = await pool.query<IssueRow>(
        `${ISSUE_SELECT} WHERE i.visibility='visible' AND (i.lifecycle_status='active' OR
      ($6::text IS NOT NULL AND i.resolved_at >= ($6::date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND i.resolved_at < (($7::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')))
      AND ST_Intersects(i.location, ST_MakeEnvelope($1,$2,$3,$4,4326)::geography)
      AND ($5::text IS NULL OR i.category=$5) ORDER BY i.last_report_at DESC LIMIT 2000`,
        [
          minLng,
          minLat,
          maxLng,
          maxLat,
          category,
          range?.from || null,
          range?.to || null,
        ],
      );
      const data: IssueGeoJson = {
        type: "FeatureCollection",
        features: result.rows.map((row) => ({
          type: "Feature",
          id: row.id,
          geometry: {
            type: "Point",
            coordinates: [Number(row.longitude), Number(row.latitude)],
          },
          properties: {
            id: row.id,
            category: row.category,
            reportsCount: row.reportsCount,
            verificationStatus: row.verificationStatus,
            lifecycleStatus: row.lifecycleStatus,
            lastReportedAt: row.lastReportedAt.toISOString(),
            resolvedAt: row.resolvedAt?.toISOString() || null,
          },
        })),
      };
      return data;
    },
  );

  app.get(
    "/api/v1/issues/nearby",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>,
    ) => {
      const parsed = coordinateSchema.safeParse(request.query);
      if (!parsed.success)
        throw new HttpError(
          400,
          "INVALID_LOCATION",
          "Informe localização e categoria válidas.",
        );
      const { longitude, latitude, category } = parsed.data;
      const maxMeters = ["lixo", "esgoto"].includes(category) ? 100 : 250;
      const result = await pool.query<IssueRow>(
        `${ISSUE_SELECT} WHERE i.visibility='visible' AND i.lifecycle_status='active' AND i.category=$3
     AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $4)
     ORDER BY ST_Distance(i.location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) ASC LIMIT 5`,
        [longitude, latitude, category, maxMeters],
      );
      return { issues: result.rows.map(toIssue), radiusMeters: maxMeters };
    },
  );

  app.get(
    "/api/v1/issues/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const issue = await findIssue(requireUuid(request.params.id));
      if (!issue)
        throw new HttpError(
          404,
          "ISSUE_NOT_FOUND",
          "Ocorrência não encontrada.",
        );
      return { issue };
    },
  );

  app.get(
    "/api/v1/media/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = requireUuid(request.params.id);
      const result = await pool.query<{ object_key: string }>(
        `
    SELECT m.object_key FROM media_files m
    JOIN reports r ON r.image_id=m.id
    JOIN issues i ON i.id=r.issue_id
    WHERE m.id=$1 AND i.visibility='visible' LIMIT 1`,
        [id],
      );
      const key = result.rows[0]?.object_key;
      if (!key)
        throw new HttpError(404, "MEDIA_NOT_FOUND", "Imagem não encontrada.");
      try {
        const image = await readFile(join(config.storageDir, key));
        return reply
          .type("image/jpeg")
          .header("Cache-Control", "private, no-store")
          .header("X-Content-Type-Options", "nosniff")
          .send(image);
      } catch {
        throw new HttpError(404, "MEDIA_NOT_FOUND", "Imagem não encontrada.");
      }
    },
  );

  app.post("/api/v1/reports", async (request, reply) => {
    if (!request.isMultipart()) {
      throw new HttpError(
        415,
        "MULTIPART_REQUIRED",
        "Use multipart/form-data.",
      );
    }
    const hashedIp = hashIp(request.ip);
    const reservation = limiter.consume(hashedIp, postRules);
    let image: StoredImage | null = null;
    let committed = false;
    try {
      const raw: Record<string, string> = {};
      let imageBuffer: Buffer | null = null;
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname !== "photo" || imageBuffer) {
            throw new HttpError(
              400,
              "INVALID_PHOTO",
              "Envie no máximo uma foto no campo photo.",
            );
          }
          imageBuffer = await part.toBuffer();
        } else {
          raw[part.fieldname] = String(part.value ?? "");
        }
      }
      const parsed = reportSchema.safeParse(raw);
      if (!parsed.success)
        throw new HttpError(
          400,
          "INVALID_REPORT",
          "Confira categoria, localização e descrição (máximo 500 caracteres).",
        );
      const { category, longitude, latitude, description } = parsed.data;
      if (imageBuffer) {
        try {
          image = await storeImage(imageBuffer);
        } catch {
          throw new HttpError(
            400,
            "INVALID_PHOTO",
            "Envie uma imagem JPEG, PNG ou WebP válida de até 8 MB.",
          );
        }
      }
      const issueId = await transaction(async (client) => {
        const created = await client.query<{ id: string }>(
          `
        INSERT INTO issues(category,description,location)
        VALUES ($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326)::geography) RETURNING id`,
          [category, description || null, longitude, latitude],
        );
        const id = created.rows[0]!.id;
        if (image) {
          await client.query(
            `INSERT INTO media_files(id,object_key,width,height) VALUES ($1,$2,$3,$4)`,
            [image.id, image.objectKey, image.width, image.height],
          );
        }
        await client.query(
          `INSERT INTO reports(issue_id,ip_hash,kind,description,image_id)
        VALUES($1,$2,'initial',$3,$4)`,
          [id, hashedIp, description || null, image?.id || null],
        );
        return id;
      });
      committed = true;
      const issue = await findIssue(issueId);
      return reply.code(201).send({ issue });
    } finally {
      if (!committed) {
        reservation.release();
        if (image) await image.remove();
      }
    }
  });

  app.post(
    "/api/v1/issues/:id/confirmations",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = requireUuid(request.params.id);
      const hashedIp = hashIp(request.ip);
      const reservation = limiter.consume(hashedIp, confirmRules);
      let committed = false;
      try {
        await transaction(async (client) => {
          const issue = await client.query<{
            visibility: string;
            lifecycle_status: string;
          }>(
            "SELECT visibility,lifecycle_status FROM issues WHERE id=$1 FOR UPDATE",
            [id],
          );
          if (!issue.rows[0] || issue.rows[0].visibility === "hidden") {
            throw new HttpError(
              404,
              "ISSUE_NOT_FOUND",
              "Ocorrência não encontrada.",
            );
          }
          if (issue.rows[0].lifecycle_status !== "active") {
            throw new HttpError(
              409,
              "ISSUE_CLOSED",
              "Esta ocorrência não está ativa.",
            );
          }
          const recent = await client.query(
            `
        SELECT 1 FROM reports WHERE issue_id=$1 AND ip_hash=$2
        AND created_at > now()-INTERVAL '24 hours' LIMIT 1`,
            [id, hashedIp],
          );
          if (recent.rowCount) {
            throw new HttpError(
              409,
              "ALREADY_CONFIRMED",
              "Este IP já relatou esta ocorrência nas últimas 24 horas.",
            );
          }
          await client.query(
            `INSERT INTO reports(issue_id,ip_hash,kind) VALUES($1,$2,'confirmation')`,
            [id, hashedIp],
          );
          await client.query(
            `UPDATE issues SET report_count=report_count+1,last_report_at=now(),
        verification_status=CASE WHEN verification_status='unverified' AND
          (SELECT COUNT(DISTINCT ip_hash) FROM reports WHERE issue_id=$1)>=3
          THEN 'corroborated' ELSE verification_status END WHERE id=$1`,
            [id],
          );
        });
        committed = true;
        const issue = await findIssue(id);
        return reply.send({ issue });
      } finally {
        if (!committed) reservation.release();
      }
    },
  );

  const cleanupTimer = setInterval(() => limiter.cleanup(), 10 * 60_000);
  cleanupTimer.unref();
  app.addHook("onClose", async () => {
    clearInterval(cleanupTimer);
  });
  return app;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await migrate();
  const app = await buildApp();
  async function shutdown(): Promise<void> {
    await app.close();
    await pool.end();
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void shutdown()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  }

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    await shutdown();
    process.exit(1);
  }
}
