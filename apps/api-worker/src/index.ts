import { Client } from "pg";
import { randomUUID } from "node:crypto";
import {
  analyzeRows,
  analyzeSpreadsheet,
  normalizeControlMeasures,
  type AssessmentAnalytics,
  type ControlMeasures,
  type InternalRow,
  type WorkforceMeta
} from "@psicorisk/domain";
import { z } from "zod";

interface Env {
  DATABASE_URL?: string;
  CORS_ORIGIN?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
}

type WorkerHandler = {
  fetch(request: Request, env: Env): Promise<Response> | Response;
};

interface StoredAssessment {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  companyName: string | null;
  unitName: string | null;
  rows: InternalRow[];
  analytics: AssessmentAnalytics;
  controlMeasures: ControlMeasures | null;
  workforce: WorkforceMeta | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateAssessmentInput {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  companyName?: string;
  unitName?: string;
  rows: InternalRow[];
  analytics: AssessmentAnalytics;
  controlMeasures?: ControlMeasures;
  workforce?: WorkforceMeta | null;
}

const controlMeasuresSchema = z
  .object({
    cipa: z.object({ atende: z.enum(["Sim", "Nao"]).optional(), peso: z.number().optional(), grupos: z.array(z.string()).optional() }).optional(),
    aet_aep: z.object({ atende: z.enum(["Sim", "Nao"]).optional(), peso: z.number().optional(), grupos: z.array(z.string()).optional() }).optional(),
    canal_etico: z.object({ atende: z.enum(["Sim", "Nao"]).optional(), peso: z.number().optional(), grupos: z.array(z.string()).optional() }).optional(),
    saude_mental: z.object({ atende: z.enum(["Sim", "Nao"]).optional(), peso: z.number().optional(), grupos: z.array(z.string()).optional() }).optional(),
    treinamento_lideranca: z.object({ atende: z.enum(["Sim", "Nao"]).optional(), peso: z.number().optional(), grupos: z.array(z.string()).optional() }).optional(),
    pesquisa_clima: z.object({ atende: z.enum(["Sim", "Nao"]).optional(), peso: z.number().optional(), grupos: z.array(z.string()).optional() }).optional(),
    afast_cidf: z
      .object({
        atende: z.enum(["Sim", "Nao"]).optional(),
        peso: z.number().optional(),
        grupos: z.array(z.string()).optional(),
        afastamentosAnalisados: z.enum(["Sim", "Nao"]).optional(),
        relacaoComTrabalho: z.enum(["Sim", "Nao"]).optional()
      })
      .optional(),
    updatedAt: z.string().optional()
  })
  .partial();

const paramsSchema = z.object({ id: z.string().min(1) });
const updateControlMeasuresBodySchema = z.object({ controlMeasures: controlMeasuresSchema });

const memoryAssessments = new Map<string, StoredAssessment>();
let storageMode: "postgres" | "memory" = "memory";
let schemaReady = false;

function getCorsOrigin(request: Request, env: Env): string {
  const configured = env.CORS_ORIGIN?.trim();
  if (!configured || configured === "*") return "*";

  const requestOrigin = request.headers.get("origin") ?? "";
  const allowedOrigins = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] ?? "*";
}

function jsonResponse(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": getCorsOrigin(request, env),
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

function mapRow(row: Record<string, unknown>): StoredAssessment {
  return {
    id: String(row.id),
    name: String(row.name),
    fileName: String(row.file_name),
    fileType: String(row.file_type),
    companyName: row.company_name ? String(row.company_name) : null,
    unitName: row.unit_name ? String(row.unit_name) : null,
    rows: row.rows as InternalRow[],
    analytics: row.analytics as AssessmentAnalytics,
    controlMeasures: normalizeControlMeasures((row.control_measures as ControlMeasures | null) ?? null),
    workforce: (row.workforce as WorkforceMeta | null) ?? null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function getDatabaseUrl(env: Env): string | null {
  return env.HYPERDRIVE?.connectionString?.trim() || env.DATABASE_URL?.trim() || null;
}

async function withClient<T>(env: Env, callback: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = getDatabaseUrl(env);
  if (!connectionString) {
    storageMode = "memory";
    throw new Error("DATABASE_URL nao configurado.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function ensureSchema(env: Env): Promise<void> {
  if (schemaReady) return;

  try {
    await withClient(env, async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS assessments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          company_name TEXT,
          unit_name TEXT,
          rows JSONB NOT NULL,
          analytics JSONB NOT NULL,
          control_measures JSONB,
          workforce JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    });

    storageMode = "postgres";
    schemaReady = true;
  } catch {
    storageMode = "memory";
    schemaReady = true;
  }
}

async function createAssessment(env: Env, input: CreateAssessmentInput): Promise<StoredAssessment> {
  if (storageMode === "memory") {
    const now = new Date().toISOString();
    const assessment: StoredAssessment = {
      id: input.id,
      name: input.name,
      fileName: input.fileName,
      fileType: input.fileType,
      companyName: input.companyName ?? null,
      unitName: input.unitName ?? null,
      rows: input.rows,
      analytics: input.analytics,
      controlMeasures: normalizeControlMeasures(input.controlMeasures ?? null),
      workforce: input.workforce ?? null,
      createdAt: now,
      updatedAt: now
    };

    memoryAssessments.set(assessment.id, assessment);
    return assessment;
  }

  return withClient(env, async (client) => {
    const result = await client.query(
      `
        INSERT INTO assessments (
          id, name, file_name, file_type, company_name, unit_name, rows, analytics, control_measures, workforce
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
        RETURNING *;
      `,
      [
        input.id,
        input.name,
        input.fileName,
        input.fileType,
        input.companyName ?? null,
        input.unitName ?? null,
        JSON.stringify(input.rows),
        JSON.stringify(input.analytics),
        JSON.stringify(input.controlMeasures ?? null),
        JSON.stringify(input.workforce ?? null)
      ]
    );

    return mapRow(result.rows[0] as Record<string, unknown>);
  });
}

async function listAssessments(env: Env): Promise<StoredAssessment[]> {
  if (storageMode === "memory") {
    return [...memoryAssessments.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  return withClient(env, async (client) => {
    const result = await client.query("SELECT * FROM assessments ORDER BY created_at DESC;");
    return result.rows.map((row: Record<string, unknown>) => mapRow(row));
  });
}

async function getAssessmentById(env: Env, id: string): Promise<StoredAssessment | null> {
  if (storageMode === "memory") {
    return memoryAssessments.get(id) ?? null;
  }

  return withClient(env, async (client) => {
    const result = await client.query("SELECT * FROM assessments WHERE id = $1 LIMIT 1;", [id]);
    if (!result.rows.length) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  });
}

async function updateAssessmentAnalytics(
  env: Env,
  id: string,
  analytics: AssessmentAnalytics,
  controlMeasures: ControlMeasures | null
): Promise<StoredAssessment | null> {
  if (storageMode === "memory") {
    const current = memoryAssessments.get(id);
    if (!current) return null;

    const updated: StoredAssessment = {
      ...current,
      analytics,
      controlMeasures: normalizeControlMeasures(controlMeasures),
      updatedAt: new Date().toISOString()
    };

    memoryAssessments.set(id, updated);
    return updated;
  }

  return withClient(env, async (client) => {
    const result = await client.query(
      `
        UPDATE assessments
           SET analytics = $2::jsonb,
               control_measures = $3::jsonb,
               updated_at = NOW()
         WHERE id = $1
     RETURNING *;
      `,
      [id, JSON.stringify(analytics), JSON.stringify(controlMeasures)]
    );

    if (!result.rows.length) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function healthPayload() {
  return {
    status: "ok",
    service: "psicorisk-api-worker",
    storage: storageMode,
    timestamp: new Date().toISOString()
  };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": getCorsOrigin(request, env),
          "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
          "access-control-allow-headers": "Content-Type"
        }
      });
    }

    await ensureSchema(env);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return jsonResponse(request, env, healthPayload());
      }

      if (request.method === "GET" && url.pathname === "/api/assessments") {
        const assessments = await listAssessments(env);
        return jsonResponse(
          request,
          env,
          assessments.map((assessment) => ({
            id: assessment.id,
            name: assessment.name,
            fileName: assessment.fileName,
            companyName: assessment.companyName,
            unitName: assessment.unitName,
            createdAt: assessment.createdAt,
            updatedAt: assessment.updatedAt,
            summary: assessment.analytics.summary
          }))
        );
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/assessments/")) {
        const id = decodeURIComponent(url.pathname.replace("/api/assessments/", ""));
        const params = paramsSchema.parse({ id });
        const assessment = await getAssessmentById(env, params.id);

        if (!assessment) {
          return jsonResponse(request, env, { message: "Avaliacao nao encontrada." }, 404);
        }

        return jsonResponse(request, env, assessment);
      }

      if (request.method === "POST" && url.pathname === "/api/assessments/import") {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
          return jsonResponse(request, env, { message: "Envie um arquivo para importar." }, 400);
        }

        const assessmentName = String(formData.get("name") ?? "").trim();
        const companyName = String(formData.get("companyName") ?? "").trim();
        const unitName = String(formData.get("unitName") ?? "").trim();
        const controlMeasuresRaw = String(formData.get("controlMeasures") ?? "").trim();
        const controlMeasures = controlMeasuresRaw
          ? (controlMeasuresSchema.parse(JSON.parse(controlMeasuresRaw)) as ControlMeasures)
          : undefined;
        const normalizedControlMeasures = normalizeControlMeasures(controlMeasures);
        const parsed = analyzeSpreadsheet(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          normalizedControlMeasures
        );

        const assessment = await createAssessment(env, {
          id: randomUUID(),
          name: assessmentName || file.name.replace(/\.[^.]+$/, ""),
          fileName: file.name,
          fileType: file.name.split(".").pop()?.toLowerCase() ?? "desconhecido",
          companyName: companyName || undefined,
          unitName: unitName || undefined,
          rows: parsed.rows,
          analytics: parsed.analytics,
          controlMeasures: normalizedControlMeasures,
          workforce: parsed.workforce
        });

        return jsonResponse(request, env, assessment, 201);
      }

      if (request.method === "PUT" && url.pathname.startsWith("/api/assessments/") && url.pathname.endsWith("/control-measures")) {
        const id = decodeURIComponent(
          url.pathname
            .replace("/api/assessments/", "")
            .replace("/control-measures", "")
        );
        const params = paramsSchema.parse({ id });
        const body = updateControlMeasuresBodySchema.parse(await request.json());
        const currentAssessment = await getAssessmentById(env, params.id);

        if (!currentAssessment) {
          return jsonResponse(request, env, { message: "Avaliacao nao encontrada." }, 404);
        }

        const normalizedControlMeasures = normalizeControlMeasures(body.controlMeasures as ControlMeasures);
        const analytics = analyzeRows(
          currentAssessment.rows,
          normalizedControlMeasures,
          currentAssessment.workforce
        );
        const updated = await updateAssessmentAnalytics(
          env,
          params.id,
          analytics,
          normalizedControlMeasures
        );

        if (!updated) {
          return jsonResponse(request, env, { message: "Avaliacao nao encontrada apos atualizacao." }, 404);
        }

        return jsonResponse(request, env, updated);
      }

      return jsonResponse(request, env, { message: "Rota nao encontrada." }, 404);
    } catch (error) {
      return jsonResponse(request, env, { message: errorMessage(error) }, 500);
    }
  }
} satisfies WorkerHandler;
