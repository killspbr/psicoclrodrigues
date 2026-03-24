import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { analyzeRows, analyzeSpreadsheet, normalizeControlMeasures, type ControlMeasures } from "@psicorisk/domain";
import { ensureSchema, getStorageMode } from "./db.js";
import {
  createAssessment,
  getAssessmentById,
  listAssessments,
  updateAssessmentAnalytics
} from "./repository.js";

const app = Fastify({
  logger: true,
  bodyLimit: 100 * 1024 * 1024
});

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

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

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  methods: ["GET", "POST", "PUT", "OPTIONS"]
});

await app.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
    fields: 20
  }
});

app.get("/api/health", async () => ({
  status: "ok",
  service: "psicorisk-api",
  storage: getStorageMode(),
  timestamp: new Date().toISOString()
}));

app.get("/api/assessments", async () => {
  const assessments = await listAssessments();
  return assessments.map((assessment) => ({
    id: assessment.id,
    name: assessment.name,
    fileName: assessment.fileName,
    companyName: assessment.companyName,
    unitName: assessment.unitName,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
    summary: assessment.analytics.summary
  }));
});

app.get("/api/assessments/:id", async (request, reply) => {
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const assessment = await getAssessmentById(params.id);

  if (!assessment) {
    return reply.code(404).send({ message: "Avaliacao nao encontrada." });
  }

  return assessment;
});

app.post("/api/assessments/import", async (request, reply) => {
  const parts = request.parts();
  let uploadedFile: { fileName: string; buffer: Buffer } | null = null;
  let assessmentName = "";
  let companyName = "";
  let unitName = "";
  let controlMeasures: ControlMeasures | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      uploadedFile = {
        fileName: part.filename,
        buffer: await part.toBuffer()
      };
      continue;
    }

    const fieldValue = String(part.value ?? "").trim();
    if (part.fieldname === "name") assessmentName = fieldValue;
    if (part.fieldname === "companyName") companyName = fieldValue;
    if (part.fieldname === "unitName") unitName = fieldValue;
    if (part.fieldname === "controlMeasures" && fieldValue) {
      controlMeasures = controlMeasuresSchema.parse(JSON.parse(fieldValue)) as ControlMeasures;
    }
  }

  if (!uploadedFile) {
    return reply.code(400).send({ message: "Envie um arquivo para importar." });
  }

  const normalizedControlMeasures = normalizeControlMeasures(controlMeasures);
  const parsed = analyzeSpreadsheet(uploadedFile.buffer, uploadedFile.fileName, normalizedControlMeasures);
  const assessment = await createAssessment({
    id: randomUUID(),
    name: assessmentName || uploadedFile.fileName.replace(/\.[^.]+$/, ""),
    fileName: uploadedFile.fileName,
    fileType: uploadedFile.fileName.split(".").pop()?.toLowerCase() ?? "desconhecido",
    companyName: companyName || undefined,
    unitName: unitName || undefined,
    rows: parsed.rows,
    analytics: parsed.analytics,
    controlMeasures: normalizedControlMeasures,
    workforce: parsed.workforce
  });

  return reply.code(201).send(assessment);
});

app.put("/api/assessments/:id/control-measures", async (request, reply) => {
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const body = z.object({ controlMeasures: controlMeasuresSchema }).parse(request.body);
  const currentAssessment = await getAssessmentById(params.id);

  if (!currentAssessment) {
    return reply.code(404).send({ message: "Avaliacao nao encontrada." });
  }

  const normalizedControlMeasures = normalizeControlMeasures(body.controlMeasures as ControlMeasures);
  const analytics = analyzeRows(currentAssessment.rows, normalizedControlMeasures, currentAssessment.workforce);
  const updated = await updateAssessmentAnalytics(params.id, analytics, normalizedControlMeasures);

  if (!updated) {
    return reply.code(404).send({ message: "Avaliacao nao encontrada apos atualizacao." });
  }

  return updated;
});

const bootstrap = async (): Promise<void> => {
  await ensureSchema();
  await app.listen({ port, host });
  app.log.info(`API disponivel em http://${host}:${port} (${getStorageMode()})`);
};

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
