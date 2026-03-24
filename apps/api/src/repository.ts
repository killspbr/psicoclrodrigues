import { normalizeControlMeasures, type AssessmentAnalytics, type ControlMeasures, type InternalRow, type WorkforceMeta } from "@psicorisk/domain";
import { getStorageMode, pool } from "./db.js";

export interface StoredAssessment {
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

const memoryAssessments = new Map<string, StoredAssessment>();

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

export async function createAssessment(input: CreateAssessmentInput): Promise<StoredAssessment> {
  if (getStorageMode() === "memory") {
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

  const result = await pool.query(
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
}

export async function listAssessments(): Promise<StoredAssessment[]> {
  if (getStorageMode() === "memory") {
    return [...memoryAssessments.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const result = await pool.query("SELECT * FROM assessments ORDER BY created_at DESC;");
  return result.rows.map((row: Record<string, unknown>) => mapRow(row));
}

export async function getAssessmentById(id: string): Promise<StoredAssessment | null> {
  if (getStorageMode() === "memory") {
    return memoryAssessments.get(id) ?? null;
  }

  const result = await pool.query("SELECT * FROM assessments WHERE id = $1 LIMIT 1;", [id]);
  if (!result.rows.length) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function updateAssessmentAnalytics(
  id: string,
  analytics: AssessmentAnalytics,
  controlMeasures: ControlMeasures | null
): Promise<StoredAssessment | null> {
  if (getStorageMode() === "memory") {
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

  const result = await pool.query(
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
}
