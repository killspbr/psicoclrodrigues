import { read, utils } from "xlsx";

export const TOTAL_QUESTIONS = 27;
export const GLOBAL_ATTENUATION_MAX = 0.2;
export const CIDF_AGGRAVATION_MAX = 0.15;

export const OFFICIAL_CATEGORIES = [
  "Metas/Demandas/Jornada de Trabalho",
  "Posto de Trabalho",
  "Percepcao em relacao as atividades realizadas",
  "Relacoes Interpessoais no Trabalho/Suporte/Assedio",
  "Fatores Pessoais e Familiares/Sociais/Financeiros"
] as const;

export type OfficialCategory = (typeof OFFICIAL_CATEGORIES)[number];
export type RiskClassification = "Baixo" | "Moderado" | "Alto";
export type Priority = "Maxima" | "Alta" | "Moderada" | "Baixa" | "Monitoramento";

export interface InternalRow {
  name: string;
  unit: string;
  department: string;
  role: string;
  sector: string;
  responseDate: string;
  category: string;
  question: string;
  answer: "Sim" | "Parcialmente" | "Nao";
  answerScore: number;
}

export interface WorkforceMeta {
  eligibleWorkers: number;
  respondentWorkers: number;
  byUnit: Record<string, { eligible: number; respondents: number }>;
}

export interface ControlMeasureItem {
  atende?: "Sim" | "Nao";
  peso?: number;
  grupos?: string[];
  afastamentosAnalisados?: "Sim" | "Nao";
  relacaoComTrabalho?: "Sim" | "Nao";
}

export interface ControlMeasures {
  cipa?: ControlMeasureItem;
  aet_aep?: ControlMeasureItem;
  canal_etico?: ControlMeasureItem;
  saude_mental?: ControlMeasureItem;
  treinamento_lideranca?: ControlMeasureItem;
  pesquisa_clima?: ControlMeasureItem;
  afast_cidf?: ControlMeasureItem;
  updatedAt?: string;
}

export type ControlMeasureKey = Exclude<keyof ControlMeasures, "updatedAt">;

export const CONTROL_MEASURE_KEYS: ControlMeasureKey[] = [
  "cipa",
  "aet_aep",
  "canal_etico",
  "saude_mental",
  "treinamento_lideranca",
  "pesquisa_clima",
  "afast_cidf"
];

export const CONTROL_MEASURE_DEFAULT_WEIGHT = 10;

export interface SummaryMetrics {
  totalResponses: number;
  employeeCount: number;
  eligibleWorkers: number | null;
  responseRate: number | null;
  alertsHigh: number;
  rawAverage: number;
  rawPoints: string;
  rawClassification: RiskClassification;
  attenuatedAverage: number;
  attenuatedPoints: string;
  attenuatedClassification: RiskClassification;
  finalAverage: number;
  finalPoints: string;
  finalClassification: RiskClassification;
  attenuationPercent: number;
  cidfPercent: number;
  activeMeasures: string[];
}

export interface CategoryMetrics {
  category: string;
  total: number;
  counts: { sim: number; parcialmente: number; nao: number };
  rawAverage: number;
  rawPoints: string;
  rawClassification: RiskClassification;
  attenuatedAverage: number;
  attenuatedPoints: string;
  attenuatedClassification: RiskClassification;
  motivators: string[];
}

export interface QuestionMetrics {
  question: string;
  category: string;
  total: number;
  counts: { sim: number; parcialmente: number; nao: number };
  rawAverage: number;
  rawClassification: RiskClassification;
  finalAverage: number;
  finalClassification: RiskClassification;
  riskScore: number;
}

export interface DepartmentMetrics {
  department: string;
  employeeCount: number;
  total: number;
  counts: { sim: number; parcialmente: number; nao: number };
  rawAverage: number;
  rawClassification: RiskClassification;
  finalAverage: number;
  finalClassification: RiskClassification;
}

export interface Recommendation {
  id: string;
  category: string;
  question: string;
  classification: RiskClassification;
  sectors: string[];
  priority: Priority;
  deadline: string;
  title: string;
  action: string;
  rationale: string;
}

export interface AssessmentAnalytics {
  generatedAt: string;
  summary: SummaryMetrics;
  categories: CategoryMetrics[];
  questions: QuestionMetrics[];
  departments: DepartmentMetrics[];
  recommendations: Recommendation[];
  workforce: WorkforceMeta | null;
}

export interface ReportSection {
  title: string;
  body: string;
}

export interface ReportModel {
  generatedAt: string;
  title: string;
  companyName: string;
  unitName: string;
  executiveSummary: string;
  technicalConclusion: string;
  methodology: string;
  controlMeasures: string[];
  controlMeasuresTable: DocxTableRow[];
  departmentSummaryTable: DocxTableRow[];
  topQuestionsTable: DocxTableRow[];
  actionPlanTable: DocxTableRow[];
  sections: ReportSection[];
}

export interface DocxTableRow {
  [key: string]: string;
}

export type DocxTemplatePayload = Record<string, string | DocxTableRow[]>;

const responseMap: Record<string, number> = {
  Sim: 1,
  SIM: 1,
  Parcialmente: 2,
  Nao: 3,
  NAO: 3
};

const controlMeasureImpact: Record<string, number> = {
  cipa: 0.25,
  aet_aep: 0.25,
  canal_etico: 0.2,
  saude_mental: 0.3,
  treinamento_lideranca: 0.25,
  pesquisa_clima: 0.2
};

export const CONTROL_MEASURE_DEFAULT_GROUPS: Record<ControlMeasureKey, string[]> = {
  cipa: ["metas", "posto", "percepcao", "relacoes"],
  aet_aep: ["metas", "posto", "percepcao", "relacoes", "fatores"],
  canal_etico: ["metas", "percepcao", "relacoes"],
  saude_mental: ["metas", "percepcao", "relacoes"],
  treinamento_lideranca: ["metas", "percepcao", "relacoes"],
  pesquisa_clima: ["metas", "posto", "percepcao", "relacoes", "fatores"],
  afast_cidf: ["metas", "posto", "percepcao", "relacoes", "fatores"]
};

const controlMeasureLabels: Record<string, string> = {
  cipa: "CIPA atuante",
  aet_aep: "AET/AEP",
  canal_etico: "Canal etico",
  saude_mental: "Programa de saude mental",
  treinamento_lideranca: "Treinamento de liderancas",
  pesquisa_clima: "Pesquisa de clima"
};

const categoryGroupMap: Record<string, string> = {
  "Metas/Demandas/Jornada de Trabalho": "metas",
  "Posto de Trabalho": "posto",
  "Percepcao em relacao as atividades realizadas": "percepcao",
  "Relacoes Interpessoais no Trabalho/Suporte/Assedio": "relacoes",
  "Fatores Pessoais e Familiares/Sociais/Financeiros": "fatores"
};

const categoryQuestionCount: Record<string, number> = {
  "Metas/Demandas/Jornada de Trabalho": 7,
  "Posto de Trabalho": 2,
  "Percepcao em relacao as atividades realizadas": 6,
  "Relacoes Interpessoais no Trabalho/Suporte/Assedio": 6,
  "Fatores Pessoais e Familiares/Sociais/Financeiros": 6
};

const recommendationCatalog: Record<string, { title: string; action: string }> = {
  "Metas/Demandas/Jornada de Trabalho": {
    title: "Revisar metas, carga e cadencia",
    action: "Revisar distribuicao de demanda, ritmo operacional, pausas e capacidade real das equipes."
  },
  "Posto de Trabalho": {
    title: "Ajustar ergonomia e condicoes fisicas",
    action: "Executar adequacoes ergonomicas e revisar barreiras fisicas que ampliam desgaste no trabalho."
  },
  "Percepcao em relacao as atividades realizadas": {
    title: "Melhorar clareza e autonomia",
    action: "Revisar desenho das atividades, autonomia percebida, comunicacao de prioridades e reconhecimento."
  },
  "Relacoes Interpessoais no Trabalho/Suporte/Assedio": {
    title: "Fortalecer suporte e governanca relacional",
    action: "Treinar liderancas, reforcar canal etico e estabelecer ritos de acompanhamento de clima e conflitos."
  },
  "Fatores Pessoais e Familiares/Sociais/Financeiros": {
    title: "Ampliar suporte psicossocial",
    action: "Estruturar apoio em saude mental, comunicacao preventiva e conexao com rede de apoio interna ou externa."
  }
};

interface QuestionSectorMetrics {
  question: string;
  category: string;
  sector: string;
  total: number;
  counts: { sim: number; parcialmente: number; nao: number };
  rawAverage: number;
  rawClassification: RiskClassification;
  finalAverage: number;
  finalClassification: RiskClassification;
}

export function normalize(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value).trim();
}

export function normalizeSearch(value: unknown): string {
  return normalize(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classify(avg: number): RiskClassification {
  if (avg >= 2.37) return "Alto";
  if (avg >= 1.7) return "Moderado";
  return "Baixo";
}

export function formatPoints(avg: number, totalQuestions = TOTAL_QUESTIONS): string {
  const points = avg * totalQuestions;
  const min = totalQuestions;
  const max = totalQuestions * 3;
  return `${points.toFixed(1)} pontos (escala ${min}-${max})`;
}

export function getCategoryQuestionCount(category: string): number {
  return categoryQuestionCount[category] ?? 6;
}

export function canonicalAnswer(answer: unknown): "Sim" | "Parcialmente" | "Nao" | null {
  const value = normalizeSearch(answer);
  if (!value) return null;
  if (value === "sim") return "Sim";
  if (value === "parcialmente") return "Parcialmente";
  if (value === "nao" || value === "não") return "Nao";
  return null;
}

export function resolveScore(answer: unknown): number | null {
  const normalizedAnswer = canonicalAnswer(answer);
  if (!normalizedAnswer) return null;
  return responseMap[normalizedAnswer] ?? null;
}

export function buildQuestionCategorySequence(): string[] {
  const blocks = [
    { name: OFFICIAL_CATEGORIES[0], count: 7 },
    { name: OFFICIAL_CATEGORIES[1], count: 2 },
    { name: OFFICIAL_CATEGORIES[2], count: 6 },
    { name: OFFICIAL_CATEGORIES[3], count: 6 },
    { name: OFFICIAL_CATEGORIES[4], count: 6 }
  ];

  const sequence: string[] = [];
  for (const block of blocks) {
    for (let index = 0; index < block.count; index += 1) {
      sequence.push(block.name);
    }
  }
  return sequence;
}

function normalizeControlMeasureItem(
  measureKey: ControlMeasureKey,
  item?: ControlMeasureItem
): ControlMeasureItem {
  const atende = item?.atende === "Sim" ? "Sim" : "Nao";
  const normalizedItem: ControlMeasureItem = {
    atende,
    peso: atende === "Sim" ? CONTROL_MEASURE_DEFAULT_WEIGHT : 0,
    grupos: CONTROL_MEASURE_DEFAULT_GROUPS[measureKey] ?? []
  };

  if (measureKey !== "afast_cidf") {
    return normalizedItem;
  }

  const afastamentosAnalisados =
    atende === "Sim" && item?.afastamentosAnalisados === "Sim" ? "Sim" : "Nao";
  const relacaoComTrabalho =
    atende === "Sim" &&
    afastamentosAnalisados === "Sim" &&
    item?.relacaoComTrabalho === "Sim"
      ? "Sim"
      : "Nao";

  return {
    ...normalizedItem,
    afastamentosAnalisados,
    relacaoComTrabalho
  };
}

export function normalizeControlMeasures(measures?: ControlMeasures | null): ControlMeasures {
  const normalized: ControlMeasures = {};

  CONTROL_MEASURE_KEYS.forEach((measureKey) => {
    normalized[measureKey] = normalizeControlMeasureItem(
      measureKey,
      measures?.[measureKey] as ControlMeasureItem | undefined
    );
  });

  if (measures?.updatedAt) {
    normalized.updatedAt = measures.updatedAt;
  }

  return normalized;
}

function getField(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source) {
      const value = normalize(source[key]);
      if (value) return value;
    }
  }
  return "";
}

function parseCsv(text: string, delimiter = ";"): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const headers = lines[0].split(delimiter).map((item) => normalize(item));
  return lines.slice(1).map((line) => {
    const columns = line.split(delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = normalize(columns[index] ?? "");
    });
    return row;
  });
}

function normalizeLongRows(rows: Record<string, unknown>[]): InternalRow[] {
  return rows
    .map((row) => {
      const answer = canonicalAnswer(getField(row, ["Resposta", "Respostaa"]));
      const answerScore = resolveScore(answer);
      const question = getField(row, ["Pergunta", "Questao", "Questão"]);
      if (!answer || answerScore == null || !question) return null;

      return {
        name: getField(row, ["Nome", "Funcionario", "Funcionário", "Colaborador"]) || "Anonimo",
        unit: getField(row, ["Unidade", "Nome Unidade", "Filial", "Obra"]) || "Sem unidade",
        department: getField(row, ["Departamento", "Departamento / Setor", "Setor", "Area", "AREA"]) || "Sem departamento",
        role: getField(row, ["Funcao", "Função", "Cargo", "Nome Cargo"]) || "",
        sector: getField(row, ["Setor", "Departamento", "Departamento / Setor", "Area", "AREA"]) || "Sem setor",
        responseDate: getField(row, ["Data Resposta", "Data"]) || "",
        category: getField(row, ["Categoria da Pergunta", "Categoria"]) || "Sem categoria",
        question,
        answer,
        answerScore
      } satisfies InternalRow;
    })
    .filter((row): row is InternalRow => row !== null);
}

function transformWideSheetToLong(sheetRows: unknown[][]): { rows: InternalRow[]; workforce: WorkforceMeta } {
  if (!Array.isArray(sheetRows) || !sheetRows.length) {
    throw new Error("Planilha vazia ou invalida.");
  }

  let headerIndex = -1;
  for (let index = 0; index < sheetRows.length; index += 1) {
    const row = sheetRows[index];
    const rowString = row.map((cell) => normalizeSearch(cell)).join(" ");
    if (
      rowString.includes("codigo da empresa") ||
      rowString.includes("nome funcionario") ||
      rowString.includes("data resposta")
    ) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Nao foi possivel localizar o cabecalho do XLSX. Verifique se existem colunas como "Nome Funcionario" ou "Data Resposta".');
  }

  const headerRow = sheetRows[headerIndex];
  let firstQuestionIndex = -1;
  let nameIndex = -1;
  let dateIndex = -1;
  let unitIndex = -1;
  let sectorIndex = -1;
  let roleIndex = -1;

  headerRow.forEach((cell, index) => {
    const value = normalizeSearch(cell);

    if (["nome", "nome funcionario", "nome do colaborador", "colaborador", "funcionario"].includes(value)) {
      nameIndex = index;
    }
    if (value.includes("data resposta") || value === "data") {
      dateIndex = index;
    }
    if (["unidade", "nome unidade", "filial", "obra"].includes(value)) {
      unitIndex = index;
    }
    if (value.includes("setor") || value.includes("departamento") || value === "area") {
      sectorIndex = index;
    }
    if (value.includes("cargo") || value.includes("funcao")) {
      roleIndex = index;
    }
    if (firstQuestionIndex === -1 && (value.includes("1.") || value.includes("suas metas"))) {
      firstQuestionIndex = index;
    }
  });

  if (nameIndex === -1) nameIndex = 2;
  if (dateIndex === -1) dateIndex = 1;
  if (firstQuestionIndex === -1) firstQuestionIndex = 11;

  const questionTexts = headerRow.slice(firstQuestionIndex).map((question) => normalize(question));
  const dataRows = sheetRows.slice(headerIndex + 1);
  const categorySequence = buildQuestionCategorySequence();
  const rows: InternalRow[] = [];
  const eligibleWorkers = new Set<string>();
  const respondentWorkers = new Set<string>();
  const workforceByUnit: Record<string, { eligible: Set<string>; respondents: Set<string> }> = {};

  dataRows.forEach((row) => {
    const name = normalize(row[nameIndex]);
    if (!name) return;

    eligibleWorkers.add(name);
    const rawUnit = unitIndex !== -1 ? row[unitIndex] : sectorIndex !== -1 ? row[sectorIndex] : "Sem unidade";
    const unit = normalize(rawUnit) || "Sem unidade";
    const unitKey = normalizeSearch(rawUnit) || "sem unidade";

    if (!workforceByUnit[unitKey]) {
      workforceByUnit[unitKey] = { eligible: new Set<string>(), respondents: new Set<string>() };
    }
    workforceByUnit[unitKey].eligible.add(name);

    const responseDate = normalize(row[dateIndex]);
    if (!responseDate) return;

    respondentWorkers.add(name);
    workforceByUnit[unitKey].respondents.add(name);

    const hasAnyAnswer = questionTexts.some((_, questionIndex) => Boolean(canonicalAnswer(row[firstQuestionIndex + questionIndex])));
    if (!hasAnyAnswer) return;

    const department = normalize(row[sectorIndex]) || unit || "Sem departamento";
    const role = roleIndex !== -1 ? normalize(row[roleIndex]) : "";
    const sector = normalize(row[sectorIndex]) || department;

    questionTexts.forEach((questionText, questionIndex) => {
      const answer = canonicalAnswer(row[firstQuestionIndex + questionIndex]);
      const answerScore = resolveScore(answer);
      if (!answer || answerScore == null) return;

      rows.push({
        name,
        unit,
        department,
        role,
        sector,
        responseDate,
        category: categorySequence[questionIndex] || "Sem categoria",
        question: questionText || `Pergunta ${questionIndex + 1}`,
        answer,
        answerScore
      });
    });
  });

  if (!rows.length) {
    throw new Error("Nenhuma resposta valida foi encontrada no XLSX.");
  }

  const byUnit: WorkforceMeta["byUnit"] = {};
  Object.entries(workforceByUnit).forEach(([unit, values]) => {
    byUnit[unit] = {
      eligible: values.eligible.size,
      respondents: values.respondents.size
    };
  });

  return {
    rows,
    workforce: {
      eligibleWorkers: eligibleWorkers.size,
      respondentWorkers: respondentWorkers.size,
      byUnit
    }
  };
}

export function parseSpreadsheetBuffer(buffer: Buffer | Uint8Array, fileName: string): { rows: InternalRow[]; workforce: WorkforceMeta | null } {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const csvRows = parseCsv(Buffer.from(buffer).toString("utf-8"));
    return {
      rows: normalizeLongRows(csvRows),
      workforce: null
    };
  }

  if (extension === "xls" || extension === "xlsx") {
    const workbook = read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Planilha nao encontrada no arquivo enviado.");
    }

    const sheet = workbook.Sheets[sheetName];
    const matrixRows = utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: null
    }) as unknown[][];

    const headerLike = matrixRows
      .slice(0, 6)
      .flat()
      .map((value) => normalizeSearch(value));

    const isWideSheet =
      headerLike.includes("codigo da empresa") ||
      headerLike.includes("nome funcionario") ||
      headerLike.includes("data resposta");

    if (isWideSheet) {
      return transformWideSheetToLong(matrixRows);
    }

    const objectRows = utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
    return {
      rows: normalizeLongRows(objectRows),
      workforce: null
    };
  }

  throw new Error("Formato nao suportado. Use csv, xls ou xlsx.");
}

export function computeGlobalProtectionFactor(measures?: ControlMeasures): { factor: number; motivators: string[] } {
  const normalizedMeasures = normalizeControlMeasures(measures);

  let impactSum = 0;
  const motivators: string[] = [];

  Object.entries(controlMeasureImpact).forEach(([key, baseImpact]) => {
    const measure = normalizedMeasures[key as ControlMeasureKey];
    if (!measure || measure.atende !== "Sim") return;

    const weight = Number(measure.peso ?? 0);
    const normalizedWeight = Math.max(0, Math.min(1, (Number.isFinite(weight) ? weight : 0) / 10));
    const impact = normalizedWeight * baseImpact;
    if (impact <= 0) return;

    impactSum += impact;
    motivators.push(`${controlMeasureLabels[key]} (peso ${weight || 0})`);
  });

  return {
    factor: Math.max(0, Math.min(1, impactSum)),
    motivators
  };
}

export function computeCategoryProtectionFactor(category: string, measures?: ControlMeasures): { factor: number; motivators: string[] } {
  const normalizedMeasures = normalizeControlMeasures(measures);
  const targetGroup = categoryGroupMap[category];
  if (!targetGroup) return { factor: 0, motivators: [] };

  let impactSum = 0;
  const motivators: string[] = [];

  Object.entries(controlMeasureImpact).forEach(([key, baseImpact]) => {
    const measure = normalizedMeasures[key as ControlMeasureKey];
    if (!measure || measure.atende !== "Sim") return;
    if (!Array.isArray(measure.grupos) || !measure.grupos.includes(targetGroup)) return;

    const weight = Number(measure.peso ?? 0);
    const normalizedWeight = Math.max(0, Math.min(1, (Number.isFinite(weight) ? weight : 0) / 10));
    const impact = normalizedWeight * baseImpact;
    if (impact <= 0) return;

    impactSum += impact;
    motivators.push(`${controlMeasureLabels[key]} (peso ${weight || 0})`);
  });

  return {
    factor: Math.max(0, Math.min(1, impactSum)),
    motivators
  };
}

export function computeCidfAggravationFactor(measures?: ControlMeasures): number {
  const normalizedMeasures = normalizeControlMeasures(measures);
  if (!normalizedMeasures.afast_cidf || normalizedMeasures.afast_cidf.atende !== "Sim") return 0;
  if (normalizedMeasures.afast_cidf.afastamentosAnalisados !== "Sim") return 0;
  if (normalizedMeasures.afast_cidf.relacaoComTrabalho !== "Sim") return 0;
  const weight = Number(normalizedMeasures.afast_cidf.peso ?? 0);
  const normalizedWeight = Math.max(0, Math.min(1, (Number.isFinite(weight) ? weight : 0) / 10));
  return normalizedWeight * CIDF_AGGRAVATION_MAX;
}

function calculatePriority(classificationName: RiskClassification, percentNo: number, percentPartial: number): Priority {
  if (percentNo < 10 && percentPartial < 50) return "Monitoramento";
  if (classificationName === "Alto" && percentNo > 60) return "Maxima";
  if (classificationName === "Alto" && percentNo >= 30) return "Alta";
  if (classificationName === "Moderado" && percentNo < 30) return "Moderada";
  if (classificationName === "Baixo") return "Baixa";
  return classificationName === "Alto" ? "Alta" : "Moderada";
}

function getClassificationRank(classification: RiskClassification): number {
  if (classification === "Alto") return 3;
  if (classification === "Moderado") return 2;
  return 1;
}

function getPriorityRank(priority: Priority): number {
  if (priority === "Maxima") return 5;
  if (priority === "Alta") return 4;
  if (priority === "Moderada") return 3;
  if (priority === "Baixa") return 2;
  return 1;
}

function buildRecommendations(questions: QuestionMetrics[], questionSectors: QuestionSectorMetrics[]): Recommendation[] {
  const sectorsByQuestion = new Map<string, QuestionSectorMetrics[]>();

  questionSectors.forEach((item) => {
    const key = `${item.category}::${item.question}`;
    const current = sectorsByQuestion.get(key) ?? [];
    current.push(item);
    sectorsByQuestion.set(key, current);
  });

  return questions
    .filter((question) => question.finalClassification === "Moderado" || question.finalClassification === "Alto")
    .map((question) => {
      const catalog = recommendationCatalog[question.category] ?? {
        title: `Tratar risco em ${question.category}`,
        action: "Executar plano de melhoria especifico para o grupo de risco identificado."
      };

      const total = question.total || 1;
      const percentNo = (question.counts.nao / total) * 100;
      const percentPartial = (question.counts.parcialmente / total) * 100;
      const priority = calculatePriority(question.finalClassification, percentNo, percentPartial);
      const deadline = docxActionDeadlines[priority] ?? "90 dias";
      const sectorEntries =
        sectorsByQuestion.get(`${question.category}::${question.question}`)?.slice() ?? [];
      sectorEntries.sort((left, right) => right.finalAverage - left.finalAverage);

      const relevantSectors = sectorEntries.filter(
        (item) => item.finalClassification === "Moderado" || item.finalClassification === "Alto"
      );

      const sectors = Array.from(
        new Set((relevantSectors.length ? relevantSectors : sectorEntries).map((item) => item.sector))
      ).sort((left, right) => left.localeCompare(right, "pt-BR"));

      return {
        id: `rec-${normalizeSearch(question.question)}-${normalizeSearch(question.finalClassification)}`,
        category: question.category,
        question: question.question,
        classification: question.finalClassification,
        sectors,
        priority,
        deadline,
        title: question.question,
        action: catalog.action,
        rationale:
          `Setores sugeridos: ${sectors.join(", ")}. ` +
          `Categoria: ${question.category}. Nível consolidado: ${question.finalClassification}. ` +
          `Média final: ${question.finalAverage.toFixed(2)}. Prazo sugerido: ${deadline}.`
      } satisfies Recommendation;
    })
    .sort((left, right) => {
      const classificationOrder = getClassificationRank(right.classification) - getClassificationRank(left.classification);
      if (classificationOrder !== 0) return classificationOrder;

      const priorityOrder = getPriorityRank(right.priority) - getPriorityRank(left.priority);
      if (priorityOrder !== 0) return priorityOrder;

      return right.deadline.localeCompare(left.deadline, "pt-BR");
    });
}

export function analyzeRows(rows: InternalRow[], controlMeasures?: ControlMeasures, workforce?: WorkforceMeta | null): AssessmentAnalytics {
  if (!rows.length) {
    throw new Error("Nao existem respostas suficientes para analise.");
  }

  const categoryMap = new Map<string, { category: string; total: number; sum: number; counts: { sim: number; parcialmente: number; nao: number } }>();
  const questionMap = new Map<string, { question: string; category: string; total: number; sum: number; counts: { sim: number; parcialmente: number; nao: number } }>();
  const questionSectorMap = new Map<
    string,
    {
      question: string;
      category: string;
      sector: string;
      total: number;
      sum: number;
      counts: { sim: number; parcialmente: number; nao: number };
    }
  >();
  const departmentMap = new Map<string, { department: string; total: number; sum: number; employees: Set<string>; counts: { sim: number; parcialmente: number; nao: number } }>();
  const employeeSet = new Set<string>();
  const levelTotals = { low: 0, moderate: 0, high: 0 };

  let globalSum = 0;

  rows.forEach((row) => {
    employeeSet.add(row.name);
    globalSum += row.answerScore;

    if (row.answer === "Sim") levelTotals.low += 1;
    if (row.answer === "Parcialmente") levelTotals.moderate += 1;
    if (row.answer === "Nao") levelTotals.high += 1;

    const currentCategory = categoryMap.get(row.category) ?? {
      category: row.category,
      total: 0,
      sum: 0,
      counts: { sim: 0, parcialmente: 0, nao: 0 }
    };
    currentCategory.total += 1;
    currentCategory.sum += row.answerScore;
    if (row.answer === "Sim") currentCategory.counts.sim += 1;
    if (row.answer === "Parcialmente") currentCategory.counts.parcialmente += 1;
    if (row.answer === "Nao") currentCategory.counts.nao += 1;
    categoryMap.set(row.category, currentCategory);

    const questionKey = `${row.category}::${row.question}`;
    const currentQuestion = questionMap.get(questionKey) ?? {
      question: row.question,
      category: row.category,
      total: 0,
      sum: 0,
      counts: { sim: 0, parcialmente: 0, nao: 0 }
    };
    currentQuestion.total += 1;
    currentQuestion.sum += row.answerScore;
    if (row.answer === "Sim") currentQuestion.counts.sim += 1;
    if (row.answer === "Parcialmente") currentQuestion.counts.parcialmente += 1;
    if (row.answer === "Nao") currentQuestion.counts.nao += 1;
    questionMap.set(questionKey, currentQuestion);

    const sectorKey = row.department || row.sector || "Sem setor";
    const questionSectorKey = `${row.category}::${row.question}::${sectorKey}`;
    const currentQuestionSector = questionSectorMap.get(questionSectorKey) ?? {
      question: row.question,
      category: row.category,
      sector: sectorKey,
      total: 0,
      sum: 0,
      counts: { sim: 0, parcialmente: 0, nao: 0 }
    };
    currentQuestionSector.total += 1;
    currentQuestionSector.sum += row.answerScore;
    if (row.answer === "Sim") currentQuestionSector.counts.sim += 1;
    if (row.answer === "Parcialmente") currentQuestionSector.counts.parcialmente += 1;
    if (row.answer === "Nao") currentQuestionSector.counts.nao += 1;
    questionSectorMap.set(questionSectorKey, currentQuestionSector);

    const departmentKey = row.department || row.sector || "Sem departamento";
    const currentDepartment = departmentMap.get(departmentKey) ?? {
      department: departmentKey,
      total: 0,
      sum: 0,
      employees: new Set<string>(),
      counts: { sim: 0, parcialmente: 0, nao: 0 }
    };
    currentDepartment.total += 1;
    currentDepartment.sum += row.answerScore;
    currentDepartment.employees.add(row.name);
    if (row.answer === "Sim") currentDepartment.counts.sim += 1;
    if (row.answer === "Parcialmente") currentDepartment.counts.parcialmente += 1;
    if (row.answer === "Nao") currentDepartment.counts.nao += 1;
    departmentMap.set(departmentKey, currentDepartment);
  });

  const employeeCount = employeeSet.size || Math.max(1, Math.round(rows.length / TOTAL_QUESTIONS));
  const rawAverage = employeeCount > 0 ? globalSum / employeeCount / TOTAL_QUESTIONS : 0;
  const globalProtection = computeGlobalProtectionFactor(controlMeasures);
  const cidfFactor = computeCidfAggravationFactor(controlMeasures);
  const attenuationEffective = Math.min(globalProtection.factor, GLOBAL_ATTENUATION_MAX);
  const attenuatedAverage = rawAverage * (1 - attenuationEffective);
  const finalAverage = attenuatedAverage * (1 + cidfFactor);
  const eligibleWorkers = workforce?.eligibleWorkers ?? null;
  const responseRate = eligibleWorkers ? (employeeCount / eligibleWorkers) * 100 : null;

  const categories = Array.from(categoryMap.values())
    .map((category) => {
      const rawAverageCategory = category.sum / (category.total || 1);
      const protection = computeCategoryProtectionFactor(category.category, controlMeasures);
      const attenuatedAverageCategory = rawAverageCategory * (1 - GLOBAL_ATTENUATION_MAX * protection.factor);
      const questionCount = getCategoryQuestionCount(category.category);

      return {
        category: category.category,
        total: category.total,
        counts: category.counts,
        rawAverage: rawAverageCategory,
        rawPoints: formatPoints(rawAverageCategory, questionCount),
        rawClassification: classify(rawAverageCategory),
        attenuatedAverage: attenuatedAverageCategory,
        attenuatedPoints: formatPoints(attenuatedAverageCategory, questionCount),
        attenuatedClassification: classify(attenuatedAverageCategory),
        motivators: protection.motivators
      } satisfies CategoryMetrics;
    })
    .sort((left, right) => right.finalAverage - left.finalAverage);

  const questions = Array.from(questionMap.values())
    .map((question) => {
      const rawAverageQuestion = question.sum / (question.total || 1);
      const finalAverageQuestion = Math.min(3, rawAverageQuestion * (1 + cidfFactor));
      return {
        question: question.question,
        category: question.category,
        total: question.total,
        counts: question.counts,
        rawAverage: rawAverageQuestion,
        rawClassification: classify(rawAverageQuestion),
        finalAverage: finalAverageQuestion,
        finalClassification: classify(finalAverageQuestion),
        riskScore: ((rawAverageQuestion - 1) / 2) * 100
      } satisfies QuestionMetrics;
    })
    .sort((left, right) => right.rawAverage - left.rawAverage);

  const questionSectors = Array.from(questionSectorMap.values())
    .map((item) => {
      const rawAverageQuestionSector = item.sum / (item.total || 1);
      const finalAverageQuestionSector = Math.min(3, rawAverageQuestionSector * (1 + cidfFactor));

      return {
        question: item.question,
        category: item.category,
        sector: item.sector,
        total: item.total,
        counts: item.counts,
        rawAverage: rawAverageQuestionSector,
        rawClassification: classify(rawAverageQuestionSector),
        finalAverage: finalAverageQuestionSector,
        finalClassification: classify(finalAverageQuestionSector)
      } satisfies QuestionSectorMetrics;
    })
    .sort((left, right) => {
      const classificationOrder =
        getClassificationRank(right.finalClassification) - getClassificationRank(left.finalClassification);
      if (classificationOrder !== 0) return classificationOrder;
      return right.finalAverage - left.finalAverage;
    });

  const departments = Array.from(departmentMap.values())
    .map((department) => {
      const rawAverageDepartment = department.sum / (department.total || 1);
      const finalAverageDepartment = Math.min(3, rawAverageDepartment * (1 + cidfFactor));
      return {
        department: department.department,
        employeeCount: department.employees.size,
        total: department.total,
        counts: department.counts,
        rawAverage: rawAverageDepartment,
        rawClassification: classify(rawAverageDepartment),
        finalAverage: finalAverageDepartment,
        finalClassification: classify(finalAverageDepartment)
      } satisfies DepartmentMetrics;
    })
    .sort((left, right) => right.rawAverage - left.rawAverage);

  const attenuationPercent = rawAverage > 0 ? ((rawAverage - attenuatedAverage) / rawAverage) * 100 : 0;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalResponses: rows.length,
      employeeCount,
      eligibleWorkers,
      responseRate,
      alertsHigh: levelTotals.high,
      rawAverage,
      rawPoints: formatPoints(rawAverage, TOTAL_QUESTIONS),
      rawClassification: classify(rawAverage),
      attenuatedAverage,
      attenuatedPoints: formatPoints(attenuatedAverage, TOTAL_QUESTIONS),
      attenuatedClassification: classify(attenuatedAverage),
      finalAverage,
      finalPoints: formatPoints(finalAverage, TOTAL_QUESTIONS),
      finalClassification: classify(finalAverage),
      attenuationPercent,
      cidfPercent: cidfFactor * 100,
      activeMeasures: globalProtection.motivators
    },
    categories,
    questions,
    departments,
    recommendations: buildRecommendations(questions, questionSectors),
    workforce: workforce ?? null
  };
}

export function analyzeSpreadsheet(
  buffer: Buffer | Uint8Array,
  fileName: string,
  controlMeasures?: ControlMeasures
): { rows: InternalRow[]; workforce: WorkforceMeta | null; analytics: AssessmentAnalytics } {
  const parsed = parseSpreadsheetBuffer(buffer, fileName);
  if (!parsed.rows.length) {
    throw new Error("Nao foi possivel gerar linhas analiticas a partir do arquivo enviado.");
  }

  return {
    rows: parsed.rows,
    workforce: parsed.workforce,
    analytics: analyzeRows(parsed.rows, controlMeasures, parsed.workforce)
  };
}

export function buildReportModel(input: {
  assessmentName: string;
  companyName?: string | null;
  unitName?: string | null;
  analytics: AssessmentAnalytics;
  controlMeasures?: ControlMeasures | null;
}): ReportModel {
  const companyName = input.companyName?.trim() || "Empresa avaliada";
  const unitName = input.unitName?.trim() || "Unidade principal";
  const summary = input.analytics.summary;
  const categoryLines = input.analytics.categories
    .slice(0, 5)
    .map(
      (category) =>
        `${category.category}: ${category.attenuatedPoints}, classificacao ${category.attenuatedClassification}.`
    );
  const topQuestions = input.analytics.questions
    .slice(0, 5)
    .map(
      (question, index) =>
        `${index + 1}. ${question.question} (${question.category}) com media ${question.finalAverage.toFixed(2)}.`
    );
  const topDepartments = input.analytics.departments
    .slice(0, 5)
    .map(
      (department) =>
        `${department.department}: media final ${department.finalAverage.toFixed(2)} com classificacao ${department.finalClassification}.`
    );
  const recommendationLines = input.analytics.recommendations
    .map((recommendation) => {
      const question = getRecommendationQuestion(recommendation);
      const sectors = getRecommendationSectors(recommendation, unitName);
      const deadline = getRecommendationDeadline(recommendation);

      return (
        `${question}: ${recommendation.action} ` +
        `Setores ${sectors.join(", ")}. ` +
        `Prioridade ${recommendation.priority}. Prazo ${deadline}.`
      );
    });
  const controlMeasures =
    summary.activeMeasures.length > 0
      ? summary.activeMeasures
      : ["Nenhuma medida de controle relevante foi registrada nesta avaliacao."];
  const controlMeasuresTable = buildControlMeasureRows(input.controlMeasures);
  const actionPlanTable = buildActionPlanRows(input.analytics.recommendations, unitName);
  const departmentSummaryTable = buildDepartmentSummaryRows(input.analytics.departments);
  const topQuestionsTable = buildTopQuestionRows(input.analytics.questions);

  const executiveSummary =
    `${companyName} - ${unitName}. A avaliacao "${input.assessmentName}" registrou ` +
    `${summary.employeeCount} respondentes e ${summary.totalResponses} respostas validas. ` +
    `O escore bruto consolidado foi ${summary.rawPoints}, com classificacao ${summary.rawClassification}. ` +
    `A aplicacao das medidas de controle levou o escore atenuado para ${summary.attenuatedPoints}, ` +
    `e o escore final ficou em ${summary.finalPoints}, com classificacao ${summary.finalClassification}.`;

  const technicalConclusion =
    `Os resultados indicam um quadro final de risco ${summary.finalClassification.toLowerCase()}, ` +
    `com reducao de ${summary.attenuationPercent.toFixed(1)}% decorrente das medidas registradas ` +
    `e agravamento adicional de ${summary.cidfPercent.toFixed(1)}% associado ao fator CID F, quando aplicavel. ` +
    `As prioridades tecnicas devem se concentrar nas categorias e perguntas de maior desfavorabilidade para reduzir a exposicao psicossocial.`;

  return {
    generatedAt: input.analytics.generatedAt,
    title: `Relatorio Psicossocial - ${input.assessmentName}`,
    companyName,
    unitName,
    executiveSummary,
    technicalConclusion,
    methodology:
      "Escala metodologica baseada em media de 1,0 a 3,0, onde Sim = 1, Parcialmente = 2 e Nao = 3. " +
      "Classificacao de risco: Baixo abaixo de 1,70; Moderado entre 1,70 e 2,36; Alto a partir de 2,37. " +
      "Atenuacao maxima global de 20% conforme medidas de controle registradas e agravamento maximo de 15% para CID F.",
    controlMeasures,
    controlMeasuresTable,
    departmentSummaryTable,
    topQuestionsTable,
    actionPlanTable,
    sections: [
      {
        title: "Resumo Executivo",
        body: executiveSummary
      },
      {
        title: "Categorias Prioritarias",
        body: categoryLines.join(" ") || "Nenhuma categoria foi consolidada para a avaliacao atual."
      },
      {
        title: "Perguntas Criticas",
        body: topQuestions.join(" ") || "Nao foram identificadas perguntas criticas para a avaliacao atual."
      },
      {
        title: "Departamentos em Destaque",
        body: topDepartments.join(" ") || "Nao foram identificados departamentos suficientes para comparacao."
      },
      {
        title: "Recomendacoes",
        body: recommendationLines.join(" ") || "Nao foram geradas recomendacoes automaticas."
      },
      {
        title: "Conclusao Tecnica",
        body: technicalConclusion
      }
    ]
  };
}

export const DOCX_TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const docxMeasureGroupLabels: Record<string, string> = {
  metas: "Metas e jornada",
  posto: "Posto de trabalho",
  percepcao: "Percepcao das atividades",
  relacoes: "Relacoes e suporte",
  fatores: "Fatores pessoais e familiares"
};

const docxMeasureFallbackGroups: Record<string, string> = {
  cipa: "Global, Organizacao do trabalho, Relacoes interpessoais, Reconhecimento e carreira",
  aet_aep: "Condicoes fisicas e ambientais, Organizacao do trabalho",
  canal_etico: "Relacoes interpessoais, Clima organizacional",
  saude_mental: "Fatores pessoais e familiares, Interface casa-trabalho, Saude mental",
  treinamento_lideranca: "Relacoes interpessoais, Organizacao do trabalho, Reconhecimento",
  pesquisa_clima: "Global, Clima organizacional",
  afast_cidf: "Global (agravante sobre todos os grupos de risco psicossocial)"
};

const docxCategoryFriendlyMap: Record<string, string> = {
  "Metas/Demandas/Jornada de Trabalho": "metas",
  "Posto de Trabalho": "posto",
  "Percepcao em relacao as atividades realizadas": "percepcao",
  "Relacoes Interpessoais no Trabalho/Suporte/Assedio": "relacoes",
  "Fatores Pessoais e Familiares/Sociais/Financeiros": "fatores"
};

const docxActionDeadlines: Record<Priority, string> = {
  Maxima: "30 dias",
  Alta: "60 dias",
  Moderada: "90 dias",
  Baixa: "120 dias",
  Monitoramento: "180 dias"
};

function getRecommendationQuestion(recommendation: Recommendation): string {
  return recommendation.question || recommendation.title || recommendation.category;
}

function getRecommendationSectors(recommendation: Recommendation, unitName: string): string[] {
  if (Array.isArray(recommendation.sectors) && recommendation.sectors.length > 0) {
    return recommendation.sectors;
  }

  return [unitName];
}

function getRecommendationClassification(recommendation: Recommendation): RiskClassification {
  if (recommendation.classification === "Baixo" || recommendation.classification === "Moderado" || recommendation.classification === "Alto") {
    return recommendation.classification;
  }

  if (recommendation.priority === "Maxima" || recommendation.priority === "Alta") return "Alto";
  if (recommendation.priority === "Moderada") return "Moderado";
  return "Baixo";
}

function getRecommendationDeadline(recommendation: Recommendation): string {
  return recommendation.deadline || docxActionDeadlines[recommendation.priority] || "90 dias";
}

const docxImageKeys = [
  "grafico_global_distribuicao",
  "grafico_global_resumo_riscos",
  "grafico_taxa_resposta",
  "grafico_global_comparacao_bruto_atenuado",
  "grafico_risco_categoria_1",
  "grafico_risco_categoria_2",
  "grafico_risco_categoria_3",
  "grafico_risco_categoria_4",
  "grafico_risco_categoria_5",
  "grafico_categoria_metas",
  "grafico_categoria_posto",
  "grafico_categoria_percepcao",
  "grafico_categoria_relacoes",
  "grafico_categoria_fatores",
  "grafico_departamentos_principal",
  "grafico_departamentos_mini_barras",
  "grafico_top10_perguntas",
  "grafico_heatmap_pergunta_departamento",
  "grafico_treemap_pergunta_departamento",
  "grafico_distribuicao_escores",
  "cards_representatividade",
  "grafico_resumo_risco",
  "grafico_heatmap",
  "grafico_treemap",
  "grafico_response_rate_chart",
  "grafico_distribution_chart",
  "grafico_risk_summary_chart",
  "grafico_departments_chart",
  "grafico_score_distribution_chart",
  "grafico_taxa_respostas",
  "tabela_top10_perguntas",
  "tabela_pergunta_departamento"
] as const;

function formatDocxDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDocxMonth(value: string): string {
  const date = new Date(value);
  const month = date.toLocaleDateString("pt-BR", { month: "long" });
  return month ? month.charAt(0).toUpperCase() + month.slice(1).toLowerCase() : "";
}

function percent(part: number, total: number): string {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function getControlMeasureStatus(item?: ControlMeasureItem): string {
  if (!item?.atende) return "Nao informado";
  return item.atende === "Sim" ? "Sim" : "Nao";
}

function getControlMeasureWeight(item?: ControlMeasureItem): string {
  return Number.isFinite(item?.peso) ? String(item?.peso ?? 0) : "0";
}

function getControlMeasureGroups(key: keyof ControlMeasures, item?: ControlMeasureItem): string {
  const groupSummary =
    Array.isArray(item?.grupos) && item.grupos.length > 0
      ? item.grupos.map((group) => docxMeasureGroupLabels[group] ?? group).join(", ")
      : docxMeasureFallbackGroups[key] ?? "";

  if (key === "afast_cidf") {
    const afastamentosAnalisados = item?.afastamentosAnalisados === "Sim" ? "Sim" : "Nao";
    const relacaoComTrabalho =
      afastamentosAnalisados === "Sim" && item?.relacaoComTrabalho === "Sim" ? "Sim" : "Nao";

    return `${groupSummary}. Afastamentos analisados: ${afastamentosAnalisados}. Relacao com o trabalho: ${relacaoComTrabalho}.`;
  }

  if (Array.isArray(item?.grupos) && item.grupos.length > 0) {
    return item.grupos.map((group) => docxMeasureGroupLabels[group] ?? group).join(", ");
  }

  return docxMeasureFallbackGroups[key] ?? "";
}

function buildActionPlanRows(
  recommendations: Recommendation[],
  unitName: string
): DocxTableRow[] {
  return recommendations.map((recommendation, index) => {
    const question = getRecommendationQuestion(recommendation);
    const sectors = getRecommendationSectors(recommendation, unitName);
    const classification = getRecommendationClassification(recommendation);
    const deadline = getRecommendationDeadline(recommendation);

    return {
      index: String(index + 1),
      prioridade: recommendation.priority,
      pergunta: question,
      setores_contexto: sectors.join(", ") || unitName,
      categoria: recommendation.category,
      classificacao: classification,
      acao: recommendation.action,
      prazo: deadline,
      situacao: "Planejada",
      responsavel_unidade: unitName
    };
  });
}

function buildDepartmentSummaryRows(departments: DepartmentMetrics[]): DocxTableRow[] {
  return departments.slice(0, 12).map((department, index) => ({
    index: String(index + 1),
    departamento: department.department,
    media_final: department.finalAverage.toFixed(2),
    classificacao: department.finalClassification,
    respondentes: String(department.employeeCount),
    respostas_nao: String(department.counts.nao)
  }));
}

function buildTopQuestionRows(questions: QuestionMetrics[]): DocxTableRow[] {
  return questions.slice(0, 10).map((question, index) => ({
    index: String(index + 1),
    pergunta: question.question,
    categoria: question.category,
    media_final: question.finalAverage.toFixed(2),
    classificacao: question.finalClassification
  }));
}

function buildControlMeasureRows(measures?: ControlMeasures | null): DocxTableRow[] {
  const normalizedMeasures = normalizeControlMeasures(measures);

  return CONTROL_MEASURE_KEYS.map((measureKey) => {
    const measure = normalizedMeasures[measureKey];
    return {
      medida: measureKey === "afast_cidf" ? "Afastamento CID F" : controlMeasureLabels[measureKey] ?? measureKey,
      situacao: getControlMeasureStatus(measure),
      escopo: getControlMeasureGroups(measureKey, measure)
    };
  });
}

export function buildDocxTemplatePayload(input: {
  assessmentName: string;
  companyName?: string | null;
  unitName?: string | null;
  analytics: AssessmentAnalytics;
  controlMeasures?: ControlMeasures | null;
}): DocxTemplatePayload {
  const companyName = input.companyName?.trim() || "Empresa avaliada";
  const unitName = input.unitName?.trim() || "Unidade principal";
  const summary = input.analytics.summary;
  const workforce = input.analytics.workforce;
  const generatedAt = input.analytics.generatedAt || new Date().toISOString();
  const responseBase = workforce?.eligibleWorkers ?? summary.eligibleWorkers ?? 0;
  const respondentCount = workforce?.respondentWorkers ?? summary.employeeCount;
  const responseRate =
    summary.responseRate != null
      ? `${summary.responseRate.toFixed(1)}% de taxa de resposta (${respondentCount} de ${responseBase || respondentCount} trabalhadores)`
      : "Taxa de resposta nao informada (faltam dados de total de trabalhadores ou respostas).";

  const questionRiskDistribution = input.analytics.questions.reduce(
    (accumulator, question) => {
      if (question.finalClassification === "Baixo") accumulator.low += 1;
      if (question.finalClassification === "Moderado") accumulator.moderate += 1;
      if (question.finalClassification === "Alto") accumulator.high += 1;
      return accumulator;
    },
    { low: 0, moderate: 0, high: 0 }
  );

  const totalQuestionRisk =
    questionRiskDistribution.low + questionRiskDistribution.moderate + questionRiskDistribution.high || 1;
  const pLow = ((questionRiskDistribution.low / totalQuestionRisk) * 100).toFixed(1);
  const pMod = ((questionRiskDistribution.moderate / totalQuestionRisk) * 100).toFixed(1);
  const pHigh = ((questionRiskDistribution.high / totalQuestionRisk) * 100).toFixed(1);

  const topRiskDepartment = input.analytics.departments[0];
  const lowestRiskDepartment = [...input.analytics.departments].sort(
    (left, right) => left.finalAverage - right.finalAverage
  )[0];
  const mostNegativeDepartment = [...input.analytics.departments].sort(
    (left, right) => right.counts.nao - left.counts.nao
  )[0];

  const departmentSummaryText = topRiskDepartment
    ? `O departamento com maior exposicao final foi ${topRiskDepartment.department}, com media ${topRiskDepartment.finalAverage.toFixed(2)} e classificacao ${topRiskDepartment.finalClassification}.`
    : "Nao ha departamentos suficientes para comparacao estatistica.";

  const actionPlanTable = buildActionPlanRows(input.analytics.recommendations, unitName);
  const departmentSummaryTable = buildDepartmentSummaryRows(input.analytics.departments);

  const measureSource = normalizeControlMeasures(input.controlMeasures);

  const controlPayload: DocxTemplatePayload = {
    cipa_situacao: getControlMeasureStatus(measureSource.cipa),
    cipa_peso: getControlMeasureWeight(measureSource.cipa),
    cipa_grupos: getControlMeasureGroups("cipa", measureSource.cipa),
    aet_aep_situacao: getControlMeasureStatus(measureSource.aet_aep),
    aet_aep_peso: getControlMeasureWeight(measureSource.aet_aep),
    aet_aep_grupos: getControlMeasureGroups("aet_aep", measureSource.aet_aep),
    canal_etico_situacao: getControlMeasureStatus(measureSource.canal_etico),
    canal_etico_peso: getControlMeasureWeight(measureSource.canal_etico),
    canal_etico_grupos: getControlMeasureGroups("canal_etico", measureSource.canal_etico),
    saude_mental_situacao: getControlMeasureStatus(measureSource.saude_mental),
    saude_mental_peso: getControlMeasureWeight(measureSource.saude_mental),
    saude_mental_grupos: getControlMeasureGroups("saude_mental", measureSource.saude_mental),
    treinamento_lideranca_situacao: getControlMeasureStatus(measureSource.treinamento_lideranca),
    treinamento_lideranca_peso: getControlMeasureWeight(measureSource.treinamento_lideranca),
    treinamento_lideranca_grupos: getControlMeasureGroups(
      "treinamento_lideranca",
      measureSource.treinamento_lideranca
    ),
    pesquisa_clima_situacao: getControlMeasureStatus(measureSource.pesquisa_clima),
    pesquisa_clima_peso: getControlMeasureWeight(measureSource.pesquisa_clima),
    pesquisa_clima_grupos: getControlMeasureGroups("pesquisa_clima", measureSource.pesquisa_clima),
    cidf_situacao: getControlMeasureStatus(measureSource.afast_cidf),
    cidf_peso: getControlMeasureWeight(measureSource.afast_cidf),
    cidf_grupos: getControlMeasureGroups("afast_cidf", measureSource.afast_cidf),
    cidf_afastamentos_analisados: getControlMeasureStatus({
      atende: measureSource.afast_cidf?.afastamentosAnalisados
    }),
    cidf_relacao_trabalho: getControlMeasureStatus({
      atende: measureSource.afast_cidf?.relacaoComTrabalho
    })
  };

  const categoryPayload = input.analytics.categories.reduce<DocxTemplatePayload>((accumulator, category, index) => {
    const position = index + 1;
    if (position <= 9) {
      accumulator[`risco_cat${position}_nome`] = category.category;
      accumulator[`risco_cat${position}_score`] = category.attenuatedPoints;
      accumulator[`risco_cat${position}_classificacao`] = category.attenuatedClassification;
    }

    const friendlyKey = docxCategoryFriendlyMap[category.category];
    if (friendlyKey) {
      accumulator[`pontos_categoria_${friendlyKey}`] = category.attenuatedPoints;
      accumulator[`classif_categoria_${friendlyKey}`] = category.attenuatedClassification;
    }

    return accumulator;
  }, {});

  const recommendationLines = actionPlanTable.map(
    (row) =>
      `${row.index}. [${row.prioridade}] ${row.pergunta} | Setores: ${row.setores_contexto} | ` +
      `Ação: ${row.acao} | Prazo: ${row.prazo}`
  );

  const payload: DocxTemplatePayload = {
    empresa: companyName,
    unidade: unitName,
    data_relatorio: formatDocxDate(generatedAt),
    mes_relatorio: formatDocxMonth(generatedAt),
    "mês_relatorio": formatDocxMonth(generatedAt),
    ano_relatorio: String(new Date(generatedAt).getFullYear()),
    taxa_resposta: responseRate,
    total_trabalhadores: String(responseBase || respondentCount),
    total_respostas: String(summary.totalResponses),
    total_perguntas: String(TOTAL_QUESTIONS),
    score_global_bruto: summary.rawPoints,
    score_global_atenuado: summary.attenuatedPoints,
    score_global_agravado: summary.finalPoints,
    pontos_geral: summary.rawPoints,
    pontos_geral_atenuado: summary.attenuatedPoints,
    classif_global_bruto: summary.rawClassification,
    classif_global_final: summary.finalClassification,
    descricao_risco_global:
      `O escore global bruto de ${summary.rawPoints} situa a avaliacao no nivel de risco ${summary.rawClassification}. ` +
      `Apos a aplicacao das medidas de protecao e agravantes, o escore final foi ${summary.finalPoints}, ` +
      `com classificacao ${summary.finalClassification}.`,
    faixas_risco_global:
      "Classificacao metodologica: Baixo abaixo de 1,70; Moderado entre 1,70 e 2,36; Alto a partir de 2,37.",
    resumo_riscos_contagens: `Escala de Pontos: ${pLow}% Baixo, ${pMod}% Moderado, ${pHigh}% Alto.`,
    resumo_riscos_texto: buildReportModel(input).executiveSummary,
    atenua_reducao_pct: summary.attenuationPercent.toFixed(1),
    atenua_reducao_max_pct: String(GLOBAL_ATTENUATION_MAX * 100),
    cidf_agravo_pct: summary.cidfPercent.toFixed(1),
    cidf_agravo_max_pct: String(CIDF_AGGRAVATION_MAX * 100),
    dept_maior_risco_nome: topRiskDepartment?.department ?? "Nao identificado",
    dept_maior_risco_pct: topRiskDepartment ? topRiskDepartment.finalAverage.toFixed(2) : "0.00",
    dept_maior_risco_nao_pct: topRiskDepartment
      ? percent(topRiskDepartment.counts.nao, topRiskDepartment.total)
      : "0.0%",
    dept_mais_nao_nome: mostNegativeDepartment?.department ?? "Nao identificado",
    dept_mais_nao_qtd: String(mostNegativeDepartment?.counts.nao ?? 0),
    dept_mais_nao_pct: mostNegativeDepartment
      ? percent(mostNegativeDepartment.counts.nao, mostNegativeDepartment.total)
      : "0.0%",
    dept_menor_risco_nome: lowestRiskDepartment?.department ?? "Nao identificado",
    dept_menor_risco_pct: lowestRiskDepartment ? lowestRiskDepartment.finalAverage.toFixed(2) : "0.00",
    dept_menor_risco_sim_pct: lowestRiskDepartment
      ? percent(lowestRiskDepartment.counts.sim, lowestRiskDepartment.total)
      : "0.0%",
    dept_resumo_texto: departmentSummaryText,
    tabela_departamentos_resumo: departmentSummaryTable,
    responsavel_unidade: unitName,
    setores_contexto:
      Array.from(new Set(actionPlanTable.flatMap((row) => String(row.setores_contexto).split(", "))))
        .filter(Boolean)
        .join(", ") || unitName,
    plano_acao_qtd: String(actionPlanTable.length),
    plano_acao_resumo: actionPlanTable.length
      ? `Foram consolidadas ${actionPlanTable.length} ações para perguntas com nível moderado ou alto.`
      : "Nenhuma ação prioritária foi identificada nesta avaliação.",
    plano_acao_itens_texto: recommendationLines.join("\n"),
    plano_acao_tabela: actionPlanTable,
    plano_acao_quadro1_tabela: actionPlanTable.slice(0, 15),
    plano_acao_quadro2_tabela: actionPlanTable.slice(15),
    departamentos_ocultados_anonimato: "0",
    ...controlPayload,
    ...categoryPayload
  };

  for (const imageKey of docxImageKeys) {
    payload[imageKey] = DOCX_TRANSPARENT_PIXEL;
  }

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value == null) {
      payload[key] = "";
    }
  }

  return payload;
}
