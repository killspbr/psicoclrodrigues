import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeRows,
  buildReportModel,
  buildDocxTemplatePayload,
  AssessmentAnalytics,
  ControlMeasures,
  CONTROL_MEASURE_DEFAULT_GROUPS,
  CONTROL_MEASURE_DEFAULT_WEIGHT,
  CONTROL_MEASURE_KEYS,
  DOCX_TRANSPARENT_PIXEL,
  InternalRow,
  normalizeControlMeasures,
  normalizeSearch,
  Priority,
  SummaryMetrics,
  WorkforceMeta
} from "@psicorisk/domain";
import {
  ensurePlaceholderConfig,
  filterDocxPayload,
  getPlaceholderBinding,
  getPlaceholderBindingDescription,
  getPlaceholderBindingLabel,
  PLACEHOLDER_CATALOG,
  PLACEHOLDER_STORAGE_KEY,
  type PlaceholderDefinition
} from "./placeholders";
import { captureReportVisualPayload, ReportVisuals } from "./reportVisuals";

interface AssessmentListItem {
  id: string;
  name: string;
  fileName: string;
  companyName: string | null;
  unitName: string | null;
  createdAt: string;
  updatedAt: string;
  summary: SummaryMetrics;
}

interface AssessmentDetail extends AssessmentListItem {
  rows: InternalRow[];
  analytics: AssessmentAnalytics;
  controlMeasures: ControlMeasures | null;
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const ALL_UNITS_VALUE = "__all_units__";
type MeasureKey = (typeof CONTROL_MEASURE_KEYS)[number];
type YesNoValue = "Sim" | "Nao";
type CidfField = "afastamentosAnalisados" | "relacaoComTrabalho";

const measureKeys = CONTROL_MEASURE_KEYS;
const emptyControlMeasures: ControlMeasures = normalizeControlMeasures();

const groupLabels: Record<string, string> = {
  metas: "Metas e jornada",
  posto: "Posto de trabalho",
  percepcao: "Percepção das atividades",
  relacoes: "Relações e suporte",
  fatores: "Fatores pessoais e familiares"
};

const measureLabels: Record<MeasureKey, string> = {
  cipa: "CIPA atuante",
  aet_aep: "AET/AEP",
  canal_etico: "Canal ético",
  saude_mental: "Programa de saúde mental",
  treinamento_lideranca: "Treinamento de lideranças",
  pesquisa_clima: "Pesquisa de clima",
  afast_cidf: "Afastamentos CID F"
};

const measureDescriptions: Record<MeasureKey, string> = {
  cipa: "Estrutura preventiva e participativa para monitorar riscos ocupacionais.",
  aet_aep: "Análise ergonômica e psicossocial aplicada ao desenho do trabalho.",
  canal_etico: "Canal formal para relato de condutas, conflitos e desvios relacionais.",
  saude_mental: "Programa estruturado de cuidado emocional e apoio especializado.",
  treinamento_lideranca: "Capacitação de lideranças para gestão saudável e suporte das equipes.",
  pesquisa_clima: "Leitura periódica do ambiente organizacional e seus fatores de risco.",
  afast_cidf: "Indicador agravante associado a afastamentos por CID F."
};

const priorityTone: Record<Priority, string> = {
  Maxima: "risk-high",
  Alta: "risk-high",
  Moderada: "risk-medium",
  Baixa: "risk-low",
  Monitoramento: "risk-low"
};

const appScreens = [
  { id: "overview", label: "Visão Geral", caption: "Leitura executiva" },
  { id: "analysis", label: "Análises", caption: "Categorias e perguntas" },
  { id: "measures", label: "Medidas", caption: "Controles e agravantes" },
  { id: "report", label: "Relatório", caption: "Documento final" },
  { id: "catalog", label: "Catálogo", caption: "Placeholders e previews" }
] as const;

const reportSectionLinks = [
  { id: "report-section-summary", label: "Resumo" },
  { id: "report-section-categories", label: "Categorias" },
  { id: "report-section-questions", label: "Perguntas" },
  { id: "report-section-departments", label: "Departamentos" },
  { id: "report-section-actions", label: "Plano de ação" },
  { id: "report-section-methodology", label: "Metodologia" }
] as const;

type ScreenId = (typeof appScreens)[number]["id"];

declare global {
  interface Window {
    PizZip?: new (input: ArrayBuffer) => any;
    docxtemplater?: new (...args: any[]) => any;
    ImageModule?: new (options: {
      centered?: boolean;
      getImage: (tagValue: string) => ArrayBuffer | null;
      getSize: (imgBuffer: unknown, tagValue: string, tagName: string) => [number, number];
    }) => any;
  }

  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
  }
}

const actionPlanColumnPreviewKeys = ["pergunta", "setores_contexto", "acao", "prioridade", "prazo"] as const;
type ActionPlanColumnPreviewKey = (typeof actionPlanColumnPreviewKeys)[number];

function isActionPlanColumnPreviewKey(value: string): value is ActionPlanColumnPreviewKey {
  return actionPlanColumnPreviewKeys.includes(value as ActionPlanColumnPreviewKey);
}

function hasPlaceholderRenderableValue(value: unknown): boolean {
  if (value == null) return false;
  if (value === DOCX_TRANSPARENT_PIXEL) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function App() {
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentDetail | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenId>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingMeasures, setSavingMeasures] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>(ALL_UNITS_VALUE);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [placeholderConfig, setPlaceholderConfig] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return ensurePlaceholderConfig();

    try {
      const saved = window.localStorage.getItem(PLACEHOLDER_STORAGE_KEY);
      return ensurePlaceholderConfig(saved ? (JSON.parse(saved) as Record<string, boolean>) : null);
    } catch {
      return ensurePlaceholderConfig();
    }
  });
  const [placeholderSearch, setPlaceholderSearch] = useState("");
  const [placeholderSourceFilter, setPlaceholderSourceFilter] = useState("all");
  const [placeholderStatusFilter, setPlaceholderStatusFilter] = useState("all");
  const [placeholderVisualPayload, setPlaceholderVisualPayload] = useState<Record<string, string>>({});
  const [loadingPlaceholderVisuals, setLoadingPlaceholderVisuals] = useState(false);
  const [pinnedPlaceholderKey, setPinnedPlaceholderKey] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSourceFilter, setCatalogSourceFilter] = useState("all");
  const [catalogPinnedPlaceholderKey, setCatalogPinnedPlaceholderKey] = useState("");
  const [catalogCopiedPlaceholderKey, setCatalogCopiedPlaceholderKey] = useState("");
  const [uploadForm, setUploadForm] = useState({
    name: "",
    companyName: ""
  });
  const [file, setFile] = useState<File | null>(null);
  const [controlMeasures, setControlMeasures] = useState<ControlMeasures>(emptyControlMeasures);

  async function fetchAssessments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/assessments`);
      if (!response.ok) throw new Error("Falha ao carregar avaliações.");
      const payload = (await response.json()) as AssessmentListItem[];
      setAssessments(payload);

      if (!selectedAssessmentId && payload.length) {
        setSelectedAssessmentId(payload[0].id);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAssessment(id: string) {
    if (!id) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/assessments/${id}`);
      if (!response.ok) throw new Error("Falha ao carregar a avaliação selecionada.");
      const payload = (await response.json()) as AssessmentDetail;
      setSelectedAssessment(payload);
      setControlMeasures(normalizeControlMeasures(payload.controlMeasures));
      setSelectedUnit(ALL_UNITS_VALUE);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAssessments();
  }, []);

  useEffect(() => {
    if (!selectedAssessmentId) return;
    void fetchAssessment(selectedAssessmentId);
  }, [selectedAssessmentId]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PLACEHOLDER_STORAGE_KEY, JSON.stringify(placeholderConfig));
  }, [placeholderConfig]);

  const availableUnits = useMemo(() => {
    if (!selectedAssessment) return [];

    return Array.from(
      new Set(
        selectedAssessment.rows
          .map((row) => row.unit?.trim())
          .filter((unit): unit is string => Boolean(unit))
      )
    ).sort((left, right) => left.localeCompare(right, "pt-BR"));
  }, [selectedAssessment]);

  const filteredRows = useMemo(() => {
    if (!selectedAssessment) return [];
    if (selectedUnit === ALL_UNITS_VALUE) return selectedAssessment.rows;
    return selectedAssessment.rows.filter((row) => row.unit === selectedUnit);
  }, [selectedAssessment, selectedUnit]);

  const filteredWorkforce = useMemo((): WorkforceMeta | null => {
    if (!selectedAssessment?.analytics.workforce) return selectedAssessment?.analytics.workforce ?? null;
    if (selectedUnit === ALL_UNITS_VALUE) return selectedAssessment.analytics.workforce;

    const unitKey = normalizeSearch(selectedUnit);
    const unitMeta = selectedAssessment.analytics.workforce.byUnit[unitKey];

    return {
      eligibleWorkers: unitMeta?.eligible ?? 0,
      respondentWorkers: unitMeta?.respondents ?? 0,
      byUnit: unitMeta ? { [unitKey]: unitMeta } : {}
    };
  }, [selectedAssessment, selectedUnit]);

  const activeAnalytics = useMemo(() => {
    if (!selectedAssessment) return null;
    if (!filteredRows.length) return null;

    return analyzeRows(
      filteredRows,
      selectedAssessment.controlMeasures ?? controlMeasures,
      filteredWorkforce
    );
  }, [selectedAssessment, selectedUnit, filteredRows, filteredWorkforce, controlMeasures]);

  const activeUnitLabel = useMemo(() => {
    if (selectedUnit !== ALL_UNITS_VALUE) return selectedUnit;
    return availableUnits.length ? "Todas as unidades" : selectedAssessment?.unitName || "Todas as unidades";
  }, [availableUnits.length, selectedAssessment?.unitName, selectedUnit]);

  const topQuestions = useMemo(
    () => activeAnalytics?.questions.slice(0, 10) ?? [],
    [activeAnalytics]
  );

  const topDepartments = useMemo(
    () => activeAnalytics?.departments.slice(0, 8) ?? [],
    [activeAnalytics]
  );

  const focusCategories = useMemo(
    () =>
      [...(activeAnalytics?.categories ?? [])]
        .sort((left, right) => right.attenuatedAverage - left.attenuatedAverage)
        .slice(0, 4),
    [activeAnalytics]
  );

  const reportModel = useMemo(() => {
    if (!selectedAssessment || !activeAnalytics) return null;
    return buildReportModel({
      assessmentName: selectedAssessment.name,
      companyName: selectedAssessment.companyName,
      unitName: activeUnitLabel,
      analytics: activeAnalytics,
      controlMeasures: selectedAssessment.controlMeasures
    });
  }, [selectedAssessment, activeAnalytics, activeUnitLabel]);

  const actionPlanRows = useMemo(
    () => reportModel?.actionPlanTable ?? [],
    [reportModel]
  );

  const executiveActionPlanRows = useMemo(
    () => actionPlanRows.slice(0, 4),
    [actionPlanRows]
  );

  useEffect(() => {
    if (activeScreen !== "catalog" || !selectedAssessment || !activeAnalytics) return;

    let cancelled = false;
    setLoadingPlaceholderVisuals(true);

    const timer = window.setTimeout(() => {
      void captureReportVisualPayload()
        .then((payload) => {
          if (!cancelled) {
            setPlaceholderVisualPayload(payload);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPlaceholderVisualPayload({});
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingPlaceholderVisuals(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeAnalytics, activeScreen, filteredRows, filteredWorkforce, selectedAssessment]);

  const placeholderRawPayload = useMemo(() => {
    if (!selectedAssessment || !activeAnalytics) return {};

    return {
      ...buildDocxTemplatePayload({
        assessmentName: selectedAssessment.name,
        companyName: selectedAssessment.companyName,
        unitName: activeUnitLabel,
        analytics: activeAnalytics,
        controlMeasures: selectedAssessment.controlMeasures
      }),
      ...placeholderVisualPayload
    };
  }, [activeAnalytics, activeUnitLabel, placeholderVisualPayload, selectedAssessment]);

  const placeholderPreviewPayload = useMemo(() => {
    const preview = filterDocxPayload(placeholderRawPayload as Record<string, unknown>, placeholderConfig);
    const normalizedPreview: Record<string, unknown> = {};

    Object.entries(preview).forEach(([key, value]) => {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        normalizedPreview[key] = "[IMAGEM GERADA]";
        return;
      }

      normalizedPreview[key] = value;
    });

    return normalizedPreview;
  }, [placeholderConfig, placeholderRawPayload]);

  const placeholderHoverPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const actionPlanRows = Array.isArray(placeholderRawPayload.plano_acao_tabela)
      ? (placeholderRawPayload.plano_acao_tabela as Array<Record<string, unknown>>)
      : [];

    PLACEHOLDER_CATALOG.forEach((placeholder) => {
      const directValue = placeholderRawPayload[placeholder.key];

      if (directValue != null && directValue !== "") {
        payload[placeholder.key] = directValue;
        return;
      }

      if (isActionPlanColumnPreviewKey(placeholder.key) && actionPlanRows.length) {
        payload[placeholder.key] = actionPlanRows.slice(0, 3).map((row) => ({
          [placeholder.key]: row[placeholder.key] ?? "-"
        }));
        return;
      }

      payload[placeholder.key] = null;
    });

    return payload;
  }, [placeholderRawPayload]);

  const placeholderSourceOptions = useMemo(
    () => Array.from(new Set(PLACEHOLDER_CATALOG.map((placeholder) => placeholder.source))).sort(),
    []
  );

  const catalogPlaceholders = useMemo(() => {
    return PLACEHOLDER_CATALOG.filter((placeholder) => {
      const search = catalogSearch.trim().toLowerCase();
      const matchesSearch =
        !search ||
        placeholder.key.toLowerCase().includes(search) ||
        placeholder.label.toLowerCase().includes(search) ||
        placeholder.description.toLowerCase().includes(search);
      const matchesSource =
        catalogSourceFilter === "all" || placeholder.source === catalogSourceFilter;

      return matchesSearch && matchesSource;
    });
  }, [catalogSearch, catalogSourceFilter]);

  const filteredPlaceholders = useMemo(() => {
    return PLACEHOLDER_CATALOG.filter((placeholder) => {
      const search = placeholderSearch.trim().toLowerCase();
      const matchesSearch =
        !search ||
        placeholder.key.toLowerCase().includes(search) ||
        placeholder.label.toLowerCase().includes(search) ||
        placeholder.description.toLowerCase().includes(search);
      const matchesSource =
        placeholderSourceFilter === "all" || placeholder.source === placeholderSourceFilter;
      const isActive = placeholderConfig[placeholder.key] !== false;
      const matchesStatus =
        placeholderStatusFilter === "all" ||
        (placeholderStatusFilter === "active" ? isActive : !isActive);

      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [placeholderConfig, placeholderSearch, placeholderSourceFilter, placeholderStatusFilter]);

  useEffect(() => {
    if (activeScreen !== "catalog") return;
    if (!catalogPlaceholders.length) {
      setCatalogPinnedPlaceholderKey("");
      return;
    }

    const hasPinned = catalogPlaceholders.some((placeholder) => placeholder.key === catalogPinnedPlaceholderKey);
    if (!hasPinned) {
      setCatalogPinnedPlaceholderKey(catalogPlaceholders[0].key);
    }
  }, [activeScreen, catalogPlaceholders, catalogPinnedPlaceholderKey]);

  const placeholderAuditRows = useMemo(() => {
    return PLACEHOLDER_CATALOG.map((placeholder) => {
      const binding = getPlaceholderBinding(placeholder);
      const value = placeholderHoverPayload[placeholder.key];
      const isActive = placeholderConfig[placeholder.key] !== false;
      const hasContent = hasPlaceholderRenderableValue(value);
      const status =
        placeholder.type === "image" && loadingPlaceholderVisuals && !hasContent
          ? "Gerando"
          : hasContent
          ? "Com conteúdo"
          : "Sem conteúdo";

      return {
        placeholder,
        binding,
        isActive,
        hasContent,
        status
      };
    });
  }, [loadingPlaceholderVisuals, placeholderConfig, placeholderHoverPayload]);

  const activePlaceholderCount = useMemo(
    () => placeholderAuditRows.filter((item) => item.isActive).length,
    [placeholderAuditRows]
  );

  const resolvedPlaceholderCount = useMemo(
    () => placeholderAuditRows.filter((item) => item.isActive && item.hasContent).length,
    [placeholderAuditRows]
  );

  const activeVisualPlaceholderCount = useMemo(
    () => placeholderAuditRows.filter((item) => item.isActive && item.placeholder.type === "image").length,
    [placeholderAuditRows]
  );

  const pendingPlaceholderRows = useMemo(
    () => placeholderAuditRows.filter((item) => item.isActive && !item.hasContent),
    [placeholderAuditRows]
  );

  const pinnedPlaceholder = useMemo(
    () => PLACEHOLDER_CATALOG.find((placeholder) => placeholder.key === pinnedPlaceholderKey) ?? null,
    [pinnedPlaceholderKey]
  );

  const pinnedPlaceholderValue = pinnedPlaceholder
    ? placeholderHoverPayload[pinnedPlaceholder.key]
    : null;

  const catalogPinnedPlaceholder = useMemo(
    () => PLACEHOLDER_CATALOG.find((placeholder) => placeholder.key === catalogPinnedPlaceholderKey) ?? null,
    [catalogPinnedPlaceholderKey]
  );

  const catalogPinnedPlaceholderValue = catalogPinnedPlaceholder
    ? placeholderHoverPayload[catalogPinnedPlaceholder.key]
    : null;

  const catalogPinnedPlaceholderBinding = catalogPinnedPlaceholder
    ? getPlaceholderBinding(catalogPinnedPlaceholder)
    : null;

  const catalogPinnedPlaceholderIsActive = catalogPinnedPlaceholder
    ? placeholderConfig[catalogPinnedPlaceholder.key] !== false
    : false;

  const catalogPinnedPlaceholderHasContent = hasPlaceholderRenderableValue(catalogPinnedPlaceholderValue);

  const activeMeasuresCount = useMemo(
    () => measureKeys.filter((measureKey) => controlMeasures[measureKey]?.atende === "Sim").length,
    [controlMeasures]
  );

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setErrorMessage("Selecione um arquivo CSV, XLS ou XLSX.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", uploadForm.name);
      formData.append("companyName", uploadForm.companyName);

      const response = await fetch(`${apiUrl}/api/assessments/import`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Falha ao importar arquivo.");
      }

      const payload = (await response.json()) as AssessmentDetail;
      setSuccessMessage("Arquivo importado e analisado com sucesso.");
      setSelectedAssessmentId(payload.id);
      setSelectedAssessment(payload);
      setActiveScreen("overview");
      setControlMeasures(normalizeControlMeasures(payload.controlMeasures));
      setSelectedUnit(ALL_UNITS_VALUE);
      setFile(null);
      setUploadForm({ name: "", companyName: "" });
      await fetchAssessments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMeasures() {
    if (!selectedAssessment) return;

    setSavingMeasures(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/assessments/${selectedAssessment.id}/control-measures`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          controlMeasures: normalizeControlMeasures({
            ...controlMeasures,
            updatedAt: new Date().toISOString()
          })
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Falha ao salvar medidas de controle.");
      }

      const payload = (await response.json()) as AssessmentDetail;
      setSelectedAssessment(payload);
      setControlMeasures(normalizeControlMeasures(payload.controlMeasures));
      setSelectedUnit((current) => {
        if (current === ALL_UNITS_VALUE) return current;
        const hasUnit = payload.rows.some((row) => row.unit === current);
        return hasUnit ? current : ALL_UNITS_VALUE;
      });
      setSuccessMessage("Medidas salvas e analytics recalculados.");
      await fetchAssessments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setSavingMeasures(false);
    }
  }

  async function handleExportDocx() {
    if (!selectedAssessment || !activeAnalytics) return;

    if (!window.PizZip || !window.docxtemplater || !window.ImageModule) {
      setErrorMessage("Bibliotecas de exportação DOCX não foram carregadas.");
      return;
    }

    setExportingDocx(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/MODELO_RELATORIO_PSICOSSOCIAIS_V2.docx");
      if (!response.ok) {
        throw new Error("Modelo DOCX não encontrado na aplicação publicada.");
      }

      const basePayload = buildDocxTemplatePayload({
        assessmentName: selectedAssessment.name,
        companyName: selectedAssessment.companyName,
        unitName: activeUnitLabel,
        analytics: activeAnalytics,
        controlMeasures: selectedAssessment.controlMeasures
      });
      const visualPayload = await captureReportVisualPayload();
      const payload = filterDocxPayload(
        {
          ...basePayload,
          ...visualPayload
        },
        placeholderConfig
      );

      const arrayBuffer = await response.arrayBuffer();
      const zip = new window.PizZip(arrayBuffer);
      const imageModule = new window.ImageModule({
        centered: false,
        getImage(tagValue: string) {
          if (!tagValue || tagValue === DOCX_TRANSPARENT_PIXEL) return null;

          try {
            const base64Data = tagValue.split(",")[1] ?? "";
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Uint8Array(byteCharacters.length);

            for (let index = 0; index < byteCharacters.length; index += 1) {
              byteNumbers[index] = byteCharacters.charCodeAt(index);
            }

            return byteNumbers.buffer;
          } catch {
            return null;
          }
        },
        getSize(_imgBuffer: unknown, _tagValue: string, tagName: string) {
          const key = String(tagName ?? "");

          if (key.includes("categoria")) return [480, 235];
          if (key.includes("depart")) return [500, 240];
          if (key.includes("heatmap") || key.includes("treemap")) return [500, 280];
          return [480, 250];
        }
      });

      const Docxtemplater = window.docxtemplater;
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: "{{", end: "}}" },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ""
      });

      doc.setData(payload);
      doc.render();

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }) as Blob;

      const normalizedName = `${selectedAssessment.companyName || selectedAssessment.name}_${activeUnitLabel}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();

      const fileName = `Relatorio_Psicossocial_${normalizedName || "avaliacao"}.docx`;
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setSuccessMessage("Relatório DOCX exportado com sucesso.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao exportar o DOCX.");
    } finally {
      setExportingDocx(false);
    }
  }

  function updateMeasureStatus(measureKey: MeasureKey, value: YesNoValue) {
    setControlMeasures((current) => {
      return normalizeControlMeasures({
        ...current,
        [measureKey]: {
          ...current[measureKey],
          atende: value
        }
      });
    });
  }

  function updateCidfField(field: CidfField, value: YesNoValue) {
    setControlMeasures((current) =>
      normalizeControlMeasures({
        ...current,
        afast_cidf: {
          ...current.afast_cidf,
          atende: current.afast_cidf?.atende === "Sim" ? "Sim" : "Nao",
          [field]: value
        }
      })
    );
  }

  function togglePlaceholder(key: string) {
    setPlaceholderConfig((current) => ({
      ...current,
      [key]: current[key] === false
    }));
  }

  function resetPlaceholders() {
    setPlaceholderConfig(ensurePlaceholderConfig());
  }

  async function copyPlaceholderTag(key: string) {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`);
      setCatalogCopiedPlaceholderKey(key);
      window.setTimeout(() => {
        setCatalogCopiedPlaceholderKey((current) => (current === key ? "" : current));
      }, 1800);
    } catch {
      setErrorMessage("Não foi possível copiar a tag do placeholder.");
    }
  }

  async function toggleFullscreen() {
    const element = appShellRef.current;
    if (!element) return;

    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        return;
      }

      setSidebarCollapsed(true);

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      }
    } catch {
      setErrorMessage("Não foi possível alternar a visualização em tela cheia.");
    }
  }

  return (
    <div
      ref={appShellRef}
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${isFullscreen ? "app-shell-fullscreen" : ""}`}
    >
      <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar-top">
          <button
            type="button"
            className="shell-icon-button sidebar-toggle-icon"
            aria-label={sidebarCollapsed ? "Mostrar sidebar" : "Ocultar sidebar"}
            title={sidebarCollapsed ? "Mostrar sidebar" : "Ocultar sidebar"}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            <span className="icon-bars" aria-hidden="true" />
          </button>

          <div className="brand-signature" aria-label="CL Rodrigues">
            <div className="brand-mark" aria-hidden="true">
              <div className="brand-diamond brand-diamond-left" />
              <div className="brand-diamond brand-diamond-right" />
              <div className="brand-diamond brand-diamond-center" />
            </div>
            <div className="brand-block">
              <div className="brand-wordmark">
                <span className="brand-wordmark-cl">CL</span>
                <span className="brand-wordmark-name">RODRIGUES</span>
              </div>
              <span className="brand-tagline">Segurança do Trabalho e Higiene Ocupacional</span>
            </div>
          </div>
        </div>

        <section className="panel sidebar-panel import-panel">
          <details className="sidebar-disclosure" open>
            <summary>
              <span>Importar avaliação</span>
              <small>Envie a planilha e crie um novo ciclo analítico.</small>
            </summary>

            <form className="stack sidebar-disclosure-body" onSubmit={handleUpload}>
              <label>
                Nome da avaliação
                <input
                  value={uploadForm.name}
                  onChange={(event) => setUploadForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: ciclo março 2026"
                />
              </label>

              <label>
                Empresa
                <input
                  value={uploadForm.companyName}
                  onChange={(event) => setUploadForm((current) => ({ ...current, companyName: event.target.value }))}
                  placeholder="Empresa avaliada"
                />
              </label>

              <label>
                Arquivo
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <button type="submit" disabled={loading}>
                {loading ? "Processando..." : "Importar e analisar"}
              </button>
            </form>
          </details>
        </section>

        <section className="panel sidebar-panel assessments-panel">
          <details className="sidebar-disclosure" open>
            <summary>
              <span>Avaliações</span>
              <small>{assessments.length} base(s) disponível(is)</small>
            </summary>

            <div className="panel-header compact sidebar-inline-action">
              <div className="mini-text">Selecione uma base para navegar pelo workspace.</div>
              <button type="button" className="ghost-button" onClick={() => void fetchAssessments()}>
                Atualizar
              </button>
            </div>

            <div className="assessment-list sidebar-disclosure-body">
              {assessments.map((assessment) => (
                <button
                  key={assessment.id}
                  type="button"
                  className={`assessment-item ${assessment.id === selectedAssessmentId ? "active" : ""}`}
                  onClick={() => setSelectedAssessmentId(assessment.id)}
                >
                  <strong>{assessment.name}</strong>
                  <span>{assessment.companyName || "Sem empresa"}</span>
                  <span>{assessment.summary.finalPoints}</span>
                </button>
              ))}
              {!assessments.length && <p className="muted">Nenhuma avaliação importada ainda.</p>}
            </div>
          </details>
        </section>
      </aside>

      <main className="content">
        <div className="shell-actions">
          {sidebarCollapsed ? (
            <button
              type="button"
              className="shell-icon-button shell-action-left"
              aria-label="Mostrar sidebar"
              title="Mostrar sidebar"
              onClick={() => setSidebarCollapsed(false)}
            >
              <span className="icon-bars" aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            className="shell-icon-button shell-action-right"
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={() => void toggleFullscreen()}
          >
            <span className={`icon-frame ${isFullscreen ? "is-active" : ""}`} aria-hidden="true" />
          </button>
        </div>

        <header className="hero">
          <div className="hero-copy">
            <div className="hero-copy-top">
              <p className="eyebrow">Workspace analítico</p>
              <div className="hero-screen-pill">
                {appScreens.find((screen) => screen.id === activeScreen)?.label ?? "Visão Geral"}
              </div>
            </div>
            <h2>{selectedAssessment?.name ?? "Selecione uma avaliação"}</h2>
            <p className="muted hero-description">
              {selectedAssessment
                ? `${selectedAssessment.companyName || "Empresa avaliada"} · ${activeUnitLabel}`
                : "Importe um arquivo para iniciar a nova base."}
            </p>
            {selectedAssessment && activeAnalytics ? (
              <div className="hero-summary">
                <div className="hero-stat">
                  <span>Classificação final</span>
                  <strong>{activeAnalytics.summary.finalClassification}</strong>
                </div>
                <div className="hero-stat">
                  <span>Respondentes</span>
                  <strong>{activeAnalytics.summary.employeeCount}</strong>
                </div>
                <div className="hero-stat">
                  <span>Unidades</span>
                  <strong>{availableUnits.length || 1}</strong>
                </div>
                <div className="hero-stat">
                  <span>Atualizado</span>
                  <strong>{new Date(selectedAssessment.updatedAt).toLocaleDateString("pt-BR")}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {selectedAssessment ? (
          <section className="workspace-toolbar">
            <div className="workspace-context">
              <span className="workspace-chip strong">{selectedAssessment.companyName || "Empresa avaliada"}</span>
              <span className="workspace-chip">{activeUnitLabel}</span>
              <span className="workspace-chip">{selectedAssessment.fileName}</span>
              <span className="workspace-chip">{`${availableUnits.length || 1} unidade(s)`}</span>
            </div>

            <div className="workspace-toolbar-side">
              <label className="unit-filter compact">
                Unidade
                <select value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value)}>
                  <option value={ALL_UNITS_VALUE}>Todas as unidades</option>
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <div className="status-stack">
                {errorMessage && <div className="status error">{errorMessage}</div>}
                {successMessage && <div className="status success">{successMessage}</div>}
              </div>
            </div>
          </section>
        ) : errorMessage || successMessage ? (
          <section className="workspace-toolbar">
            <div className="workspace-toolbar-side">
              <div className="status-stack">
                {errorMessage && <div className="status error">{errorMessage}</div>}
                {successMessage && <div className="status success">{successMessage}</div>}
              </div>
            </div>
          </section>
        ) : null}

        <nav className="screen-tabs sticky-tabs">
          {appScreens.map((screen) => (
            <button
              key={screen.id}
              type="button"
              className={`screen-tab ${activeScreen === screen.id ? "active" : ""}`}
              onClick={() => setActiveScreen(screen.id)}
            >
              <strong>{screen.label}</strong>
              <span>{screen.caption}</span>
            </button>
          ))}
        </nav>

        {selectedAssessment ? activeAnalytics ? (
          <>
            {activeScreen === "overview" ? (
            <>
            <section className="grid cards-grid">
              <SummaryCard label="Bruto" value={activeAnalytics.summary.rawPoints} tone={activeAnalytics.summary.rawClassification} />
              <SummaryCard label="Atenuado" value={activeAnalytics.summary.attenuatedPoints} tone={activeAnalytics.summary.attenuatedClassification} />
              <SummaryCard label="Final" value={activeAnalytics.summary.finalPoints} tone={activeAnalytics.summary.finalClassification} />
              <SummaryCard
                label="Amostra"
                value={`${activeAnalytics.summary.employeeCount} respondentes`}
                tone="Baixo"
                detail={
                  activeAnalytics.summary.responseRate != null
                    ? `${activeAnalytics.summary.responseRate.toFixed(1)}% de resposta`
                    : "Sem taxa calculada"
                }
              />
            </section>

            <section className="panel executive-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Painel Gerencial</p>
                  <h2>Cockpit estratégico do recorte atual</h2>
                </div>
                <span className={`pill ${priorityTone[mapClassificationToPriority(activeAnalytics.summary.finalClassification)]}`}>
                  {activeAnalytics.summary.finalClassification}
                </span>
              </div>

              <div className="executive-grid">
                <article className="executive-card executive-card-spotlight">
                  <span className="executive-label">Risco final consolidado</span>
                  <strong>{activeAnalytics.summary.finalPoints}</strong>
                  <p>{reportModel?.executiveSummary ?? "Leitura consolidada indisponivel para este recorte."}</p>

                  <div className="executive-inline-stats">
                    <div className="executive-inline-stat">
                      <span>Média bruta</span>
                      <strong>{activeAnalytics.summary.rawAverage.toFixed(2)}</strong>
                    </div>
                    <div className="executive-inline-stat">
                      <span>Atenuação</span>
                      <strong>{`${activeAnalytics.summary.attenuationPercent.toFixed(1)}%`}</strong>
                    </div>
                    <div className="executive-inline-stat">
                      <span>CID F</span>
                      <strong>{`${activeAnalytics.summary.cidfPercent.toFixed(1)}%`}</strong>
                    </div>
                  </div>
                </article>

                <article className="executive-card">
                  <div className="panel-header compact">
                    <div>
                      <h3>Frentes prioritárias</h3>
                      <p className="mini-text">Onde a gestão precisa agir primeiro.</p>
                    </div>
                  </div>

                  <div className="executive-ranking-list">
                    {focusCategories.map((category, index) => (
                      <div className="executive-rank-row" key={category.category}>
                        <div className="executive-rank-index">{index + 1}</div>
                        <div className="executive-rank-copy">
                          <strong>{category.category}</strong>
                          <span>{`${category.attenuatedPoints} | ${category.counts.nao} respostas negativas`}</span>
                        </div>
                        <span className={`pill ${priorityTone[mapClassificationToPriority(category.attenuatedClassification)]}`}>
                          {category.attenuatedClassification}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="executive-card">
                  <div className="panel-header compact">
                    <div>
                      <h3>Prontidao operacional</h3>
                      <p className="mini-text">Capacidade atual de resposta da organização.</p>
                    </div>
                  </div>

                  <div className="executive-metric-grid">
                    <div className="executive-metric-card">
                      <span>Taxa de resposta</span>
                      <strong>
                        {activeAnalytics.summary.responseRate != null
                          ? `${activeAnalytics.summary.responseRate.toFixed(1)}%`
                          : "n/d"}
                      </strong>
                    </div>
                    <div className="executive-metric-card">
                      <span>Alertas altos</span>
                      <strong>{activeAnalytics.summary.alertsHigh}</strong>
                    </div>
                    <div className="executive-metric-card">
                      <span>Medidas ativas</span>
                      <strong>{activeAnalytics.summary.activeMeasures.length}</strong>
                    </div>
                    <div className="executive-metric-card">
                      <span>Planos sugeridos</span>
                      <strong>{activeAnalytics.recommendations.length}</strong>
                    </div>
                  </div>

                  <p className="mini-text executive-footnote">
                    Medidas ativas:{" "}
                    {activeAnalytics.summary.activeMeasures.length
                      ? activeAnalytics.summary.activeMeasures.join(", ")
                      : "nenhuma informada"}
                  </p>
                </article>
              </div>
            </section>

            <section className="grid two-columns dashboard-grid">
              <article className="panel dashboard-panel dashboard-panel-context">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Leitura Tatica</p>
                    <h2>Departamentos em foco</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setActiveScreen("analysis")}>
                    Abrir análises
                  </button>
                </div>

                <div className="dashboard-list">
                  {topDepartments.slice(0, 5).map((department, index) => (
                    <div className="dashboard-row" key={department.department}>
                      <div className="dashboard-row-main">
                        <span className="dashboard-row-index">{index + 1}</span>
                        <div>
                          <strong>{department.department}</strong>
                          <div className="mini-text">{`${department.employeeCount} pessoas | média ${department.finalAverage.toFixed(2)}`}</div>
                        </div>
                      </div>
                      <span className={`pill ${priorityTone[mapClassificationToPriority(department.finalClassification)]}`}>
                        {department.finalClassification}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Sinais Críticos</p>
                    <h2>Perguntas que puxam o risco</h2>
                  </div>
                  <span>{topQuestions.length} itens</span>
                </div>

                <div className="dashboard-list">
                  {topQuestions.slice(0, 5).map((question, index) => (
                    <div className="dashboard-row" key={`${question.category}-${question.question}`}>
                      <div className="dashboard-row-main">
                        <span className="dashboard-row-index">{index + 1}</span>
                        <div>
                          <strong>{question.question}</strong>
                          <div className="mini-text">{`${question.category} | média final ${question.finalAverage.toFixed(2)}`}</div>
                        </div>
                      </div>
                      <span className={`pill ${priorityTone[mapClassificationToPriority(question.finalClassification)]}`}>
                        {question.finalClassification}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid two-columns dashboard-grid">
              <article className="panel dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Agenda Executiva</p>
                    <h2>Próximos movimentos sugeridos</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => setActiveScreen("report")}>
                    Abrir relatório
                  </button>
                </div>

                <div className="dashboard-action-list">
                  {executiveActionPlanRows.map((row, index) => (
                    <ActionPlanCard key={`executive-plan-${row.pergunta}-${index}`} row={row} />
                  ))}
                  {!executiveActionPlanRows.length && (
                    <p className="mini-text">Nenhuma ação prioritária foi consolidada para este recorte.</p>
                  )}
                </div>
              </article>

              <article className="panel dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Base Analítica</p>
                    <h2>Contexto operacional</h2>
                  </div>
                </div>

                <div className="executive-metric-grid">
                  <div className="executive-metric-card">
                    <span>Arquivo base</span>
                    <strong>{selectedAssessment.fileName}</strong>
                  </div>
                  <div className="executive-metric-card">
                    <span>Recorte</span>
                    <strong>{activeUnitLabel}</strong>
                  </div>
                  <div className="executive-metric-card">
                    <span>Atualizado em</span>
                    <strong>{new Date(selectedAssessment.updatedAt).toLocaleDateString("pt-BR")}</strong>
                  </div>
                  <div className="executive-metric-card">
                    <span>Respondentes</span>
                    <strong>{activeAnalytics.summary.employeeCount}</strong>
                  </div>
                </div>

                <div className="dashboard-shortcuts">
                  <button type="button" onClick={() => setActiveScreen("analysis")}>
                    Análises detalhadas
                  </button>
                  <button type="button" onClick={() => setActiveScreen("measures")}>
                    Medidas de controle
                  </button>
                  <button type="button" onClick={() => setActiveScreen("report")}>
                    Relatório final
                  </button>
                </div>
              </article>
            </section>
            </>
            ) : null}

            {activeScreen === "analysis" ? (
            <>
            <section className="grid two-columns">
              <article className="panel">
                <div className="panel-header">
                  <h2>Categorias</h2>
                  <span>{activeAnalytics.categories.length} grupos</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Bruto</th>
                        <th>Atenuado</th>
                        <th>Risco</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAnalytics.categories.map((category) => (
                        <tr key={category.category}>
                          <td>
                            <strong>{category.category}</strong>
                            <div className="mini-text">
                              Atenuadores: {category.motivators.length ? category.motivators.join(", ") : "nenhum"}
                            </div>
                          </td>
                          <td>{category.rawPoints}</td>
                          <td>{category.attenuatedPoints}</td>
                          <td>{category.attenuatedClassification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h2>Top perguntas</h2>
                  <span>{topQuestions.length} itens</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pergunta</th>
                        <th>Categoria</th>
                        <th>Media</th>
                        <th>Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topQuestions.map((question) => (
                        <tr key={`${question.category}-${question.question}`}>
                          <td>{question.question}</td>
                          <td>{question.category}</td>
                          <td>{question.rawAverage.toFixed(2)}</td>
                          <td>{question.finalAverage.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

            <section className="grid two-columns">
              <article className="panel">
                <div className="panel-header">
                  <h2>Departamentos</h2>
                  <span>{topDepartments.length} visíveis</span>
                </div>
                <div className="department-list">
                  {topDepartments.map((department) => (
                    <div className="department-row" key={department.department}>
                      <div>
                        <strong>{department.department}</strong>
                        <div className="mini-text">{department.employeeCount} pessoas</div>
                      </div>
                      <div className="department-score">
                        <span>{department.finalAverage.toFixed(2)}</span>
                        <span className={`pill ${priorityTone[mapClassificationToPriority(department.finalClassification)]}`}>
                          {department.finalClassification}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h2>Plano sugerido</h2>
                  <span>{actionPlanRows.length} ações</span>
                </div>
                <div className="recommendation-list">
                  {actionPlanRows.map((row, index) => (
                    <ActionPlanCard key={`analysis-plan-${row.pergunta}-${index}`} row={row} />
                  ))}
                </div>
              </article>
            </section>
            </>
            ) : null}

            {activeScreen === "measures" ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Painel de Controle</p>
                  <h2>Medidas de controle</h2>
                </div>
                <button type="button" onClick={() => void handleSaveMeasures()} disabled={savingMeasures}>
                  {savingMeasures ? "Salvando..." : "Salvar recálculo"}
                </button>
              </div>

              <section className="measure-summary">
                <article className="measure-summary-card">
                  <span className="mini-text">Ativas</span>
                  <strong>{activeMeasuresCount}</strong>
                  <small className="mini-text">de {measureKeys.length} medidas</small>
                </article>
                <article className="measure-summary-card">
                  <span className="mini-text">Peso padrão</span>
                  <strong>{CONTROL_MEASURE_DEFAULT_WEIGHT}</strong>
                  <small className="mini-text">aplicado automaticamente</small>
                </article>
                <article className="measure-summary-card">
                  <span className="mini-text">Escopo</span>
                  <strong>Padrão do sistema</strong>
                  <small className="mini-text">detalhes sob demanda em cada card</small>
                </article>
              </section>

              <div className="measure-grid compact-measure-grid">
                {measureKeys.map((measureKey) => {
                  const label = measureLabels[measureKey];
                  const measure = controlMeasures[measureKey];
                  const affectedGroups = CONTROL_MEASURE_DEFAULT_GROUPS[measureKey]
                    .map((group) => groupLabels[group] ?? group)
                    .join(", ");
                  const isActive = measure?.atende === "Sim";
                  const isCidf = measureKey === "afast_cidf";
                  const afastamentosAnalisados = isCidf && measure?.afastamentosAnalisados === "Sim";
                  const relacaoComTrabalho = isCidf && measure?.relacaoComTrabalho === "Sim";
                  const scopeCopy =
                    isCidf
                      ? "Agravo global sobre todos os grupos de risco."
                      : affectedGroups;

                  return (
                    <div className="measure-card" key={measureKey}>
                      <div className="measure-head">
                        <div className="measure-copy">
                          <strong>{label}</strong>
                          <p className="mini-text">{measureDescriptions[measureKey]}</p>
                        </div>
                        <span className={`pill ${isActive ? "risk-low" : "risk-medium"}`}>
                          {isActive ? "Ativa" : "Inativa"}
                        </span>
                      </div>

                      <div className="measure-toggle-group">
                        <button
                          type="button"
                          className={`measure-toggle ${isActive ? "active" : ""}`}
                          onClick={() => updateMeasureStatus(measureKey, "Sim")}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          className={`measure-toggle ${!isActive ? "active" : ""}`}
                          onClick={() => updateMeasureStatus(measureKey, "Nao")}
                        >
                          Não
                        </button>
                      </div>

                      {isCidf && isActive ? (
                        <div className="measure-subsection">
                          <div className="measure-subitem">
                            <span className="mini-text">Os afastamentos foram analisados?</span>
                            <div className="measure-toggle-group measure-subtoggle-group">
                              <button
                                type="button"
                                className={`measure-toggle ${afastamentosAnalisados ? "active" : ""}`}
                                onClick={() => updateCidfField("afastamentosAnalisados", "Sim")}
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                className={`measure-toggle ${!afastamentosAnalisados ? "active" : ""}`}
                                onClick={() => updateCidfField("afastamentosAnalisados", "Nao")}
                              >
                                Não
                              </button>
                            </div>
                          </div>

                          {afastamentosAnalisados ? (
                            <div className="measure-subitem">
                              <span className="mini-text">Foi identificada relação com o trabalho?</span>
                              <div className="measure-toggle-group measure-subtoggle-group">
                                <button
                                  type="button"
                                  className={`measure-toggle ${relacaoComTrabalho ? "active" : ""}`}
                                  onClick={() => updateCidfField("relacaoComTrabalho", "Sim")}
                                >
                                  Sim
                                </button>
                                <button
                                  type="button"
                                  className={`measure-toggle ${!relacaoComTrabalho ? "active" : ""}`}
                                  onClick={() => updateCidfField("relacaoComTrabalho", "Nao")}
                                >
                                  Não
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <p className={`cidf-note ${relacaoComTrabalho ? "active" : ""}`}>
                            O agravamento por CID F só entra no cálculo quando os afastamentos foram
                            analisados e houve relação com o trabalho.
                          </p>
                        </div>
                      ) : null}

                      <details className="measure-details">
                        <summary>Ver escopo padrão</summary>
                        <div className="measure-scope">
                          <p>{scopeCopy}</p>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </section>
            ) : null}

            {activeScreen === "report" && reportModel ? (
              <section className="panel report-panel" id="report-panel">
                <div className="panel-header report-toolbar no-print">
                  <div>
                    <p className="eyebrow">Relatório Final</p>
                    <h2>{reportModel.title}</h2>
                    <div className="report-toolbar-meta">
                      <span className="placeholder-chip subtle">{activeUnitLabel}</span>
                      <span className="placeholder-chip subtle">{`${reportModel.sections.length} seções narrativas`}</span>
                      <span className="placeholder-chip subtle">{`${activePlaceholderCount} placeholders ativos`}</span>
                    </div>
                  </div>
                  <div className="toolbar-actions">
                    <button type="button" onClick={() => void handleExportDocx()} disabled={exportingDocx}>
                      {exportingDocx ? "Exportando DOCX..." : "Exportar DOCX"}
                    </button>
                    <button type="button" onClick={() => window.print()}>
                      Imprimir / PDF
                    </button>
                  </div>
                </div>

                <nav className="report-section-nav no-print" aria-label="Atalhos do relatório">
                  {reportSectionLinks.map((sectionLink) => (
                    <a key={sectionLink.id} href={`#${sectionLink.id}`} className="report-section-link">
                      {sectionLink.label}
                    </a>
                  ))}
                </nav>

                <article className="report-document">
                  <header className="report-header" id="report-section-summary">
                    <div>
                      <p className="eyebrow">Relatório Psicossocial</p>
                      <h1>{reportModel.companyName}</h1>
                      <p className="muted">{reportModel.unitName}</p>
                    </div>
                    <div className="report-meta">
                      <span>Avaliação: {selectedAssessment.name}</span>
                      <span>Unidade: {activeUnitLabel}</span>
                      <span>Emitido em: {new Date(reportModel.generatedAt).toLocaleString("pt-BR")}</span>
                      <span>Base analítica: plataforma migrada</span>
                    </div>
                  </header>

                  <section className="report-highlight report-page-break-avoid">
                    <h2>Resumo Executivo</h2>
                    <p>{reportModel.executiveSummary}</p>
                  </section>

                  <section className="report-kpis report-page-break-avoid">
                    <div>
                      <span>Bruto</span>
                      <strong>{activeAnalytics.summary.rawPoints}</strong>
                      <small>{activeAnalytics.summary.rawClassification}</small>
                    </div>
                    <div>
                      <span>Atenuado</span>
                      <strong>{activeAnalytics.summary.attenuatedPoints}</strong>
                      <small>{activeAnalytics.summary.attenuatedClassification}</small>
                    </div>
                    <div>
                      <span>Final</span>
                      <strong>{activeAnalytics.summary.finalPoints}</strong>
                      <small>{activeAnalytics.summary.finalClassification}</small>
                    </div>
                    <div>
                      <span>Amostra</span>
                      <strong>{activeAnalytics.summary.employeeCount}</strong>
                      <small>respondentes</small>
                    </div>
                  </section>

                  <ReportVisuals analytics={activeAnalytics} rows={filteredRows} workforce={filteredWorkforce} />

                  <section className="report-grid report-page-break-avoid">
                    <div className="report-card">
                      <h3>Matriz de Medidas de Controle</h3>
                      <ReportTable
                        columns={[
                          { key: "medida", label: "Medida" },
                          { key: "situacao", label: "Situação" },
                          { key: "escopo", label: "Escopo" }
                        ]}
                        rows={reportModel.controlMeasuresTable}
                      />
                    </div>
                    <div className="report-card">
                      <h3>Conclusão Técnica</h3>
                      <p>{reportModel.technicalConclusion}</p>
                    </div>
                  </section>

                  <section className="report-section report-page-break-before" id="report-section-categories">
                    <h2>Risco por Categoria</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th>Bruto</th>
                          <th>Atenuado</th>
                          <th>Risco Final</th>
                        </tr>
                      </thead>
                      <tbody>
                      {activeAnalytics.categories.map((category) => (
                          <tr key={`report-category-${category.category}`}>
                            <td>{category.category}</td>
                            <td>{category.rawPoints}</td>
                            <td>{category.attenuatedPoints}</td>
                            <td>{category.attenuatedClassification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  <section className="report-section report-page-break-before" id="report-section-questions">
                    <h2>Tabela de Perguntas Críticas</h2>
                    <ReportTable
                      columns={[
                        { key: "index", label: "#" },
                        { key: "pergunta", label: "Pergunta" },
                        { key: "categoria", label: "Categoria" },
                        { key: "media_final", label: "Média Final" },
                        { key: "classificacao", label: "Classificação" }
                      ]}
                      rows={reportModel.topQuestionsTable}
                    />
                  </section>

                  <section className="report-grid report-page-break-avoid">
                    <div className="report-card">
                      <h3>Perguntas Críticas</h3>
                      <ol>
                        {topQuestions.map((question) => (
                          <li key={`report-question-${question.category}-${question.question}`}>
                            <strong>{question.question}</strong>
                            <div className="mini-text">
                              {question.category} | média final {question.finalAverage.toFixed(2)} | {question.finalClassification}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="report-card">
                      <h3>Departamentos em Destaque</h3>
                      <ul>
                        {topDepartments.map((department) => (
                          <li key={`report-department-${department.department}`}>
                            <strong>{department.department}</strong>
                            <div className="mini-text">
                              {department.employeeCount} pessoas | média final {department.finalAverage.toFixed(2)} | {department.finalClassification}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  <section className="report-section report-page-break-before" id="report-section-departments">
                    <h2>Tabela de Departamentos</h2>
                    <ReportTable
                      columns={[
                        { key: "departamento", label: "Departamento" },
                        { key: "media_final", label: "Média Final" },
                        { key: "classificacao", label: "Classificação" },
                        { key: "respondentes", label: "Respondentes" },
                        { key: "respostas_nao", label: "Respostas Não" }
                      ]}
                      rows={reportModel.departmentSummaryTable}
                    />
                  </section>

                  <section className="report-section report-page-break-before" id="report-section-actions">
                    <h2>Plano de Ação Sugerido</h2>
                    <div className="recommendation-list report-recommendations">
                      {actionPlanRows.map((row, index) => (
                        <ActionPlanCard key={`report-plan-${row.pergunta}-${index}`} row={row} />
                      ))}
                    </div>
                  </section>

                  <section className="report-section report-page-break-before">
                    <h2>Plano de Ação Estruturado</h2>
                    <ReportTable
                      columns={[
                        { key: "pergunta", label: "Pergunta" },
                        { key: "setores_contexto", label: "Setores" },
                        { key: "acao", label: "Ação" },
                        { key: "prioridade", label: "Prioridade" },
                        { key: "prazo", label: "Prazo" },
                        { key: "classificacao", label: "Nível" }
                      ]}
                      rows={reportModel.actionPlanTable}
                    />
                  </section>

                  <section className="report-section report-page-break-before" id="report-section-methodology">
                    <h2>Metodologia</h2>
                    <p>{reportModel.methodology}</p>
                  </section>

                  <section className="report-section report-page-break-avoid">
                    <h2>Seções Narrativas</h2>
                    <div className="narrative-list">
                      {reportModel.sections.map((section) => (
                        <article key={section.title} className="narrative-card">
                          <h3>{section.title}</h3>
                          <p>{section.body}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                </article>
              </section>
            ) : null}

            {activeScreen === "catalog" ? (
              <section className="grid placeholder-catalog-layout">
                <article className="panel placeholder-catalog-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Catálogo de Placeholders</p>
                      <h2>Seleção visual para exportação</h2>
                    </div>
                    <div className="toolbar-actions">
                      <span className="placeholder-chip subtle">{`${catalogPlaceholders.length} itens no recorte`}</span>
                      <span className="placeholder-chip subtle">Salvamento automático</span>
                    </div>
                  </div>

                  <section className="placeholder-catalog-toolbar">
                    <label>
                      Buscar
                      <input
                        value={catalogSearch}
                        onChange={(event) => setCatalogSearch(event.target.value)}
                        placeholder="Nome, tag ou descrição"
                      />
                    </label>

                    <div className="placeholder-source-pills" role="tablist" aria-label="Filtro por origem">
                      <button
                        type="button"
                        className={`placeholder-source-pill ${catalogSourceFilter === "all" ? "active" : ""}`}
                        onClick={() => setCatalogSourceFilter("all")}
                      >
                        Todos
                      </button>
                      {placeholderSourceOptions.map((source) => (
                        <button
                          key={source}
                          type="button"
                          className={`placeholder-source-pill ${catalogSourceFilter === source ? "active" : ""}`}
                          onClick={() => setCatalogSourceFilter(source)}
                        >
                          {source}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="metrics">
                    <Metric label="Ativos" value={String(activePlaceholderCount)} />
                    <Metric label="Com conteúdo" value={`${resolvedPlaceholderCount}/${activePlaceholderCount || 0}`} />
                    <Metric label="Pendentes" value={String(pendingPlaceholderRows.length)} />
                    <Metric label="Visuais" value={String(activeVisualPlaceholderCount)} />
                    <Metric label="Recorte" value={activeUnitLabel} />
                  </section>

                  {catalogPlaceholders.length ? (
                    <div className="placeholder-catalog-grid">
                      {catalogPlaceholders.map((placeholder, index) => {
                        const isSelected = catalogPinnedPlaceholderKey === placeholder.key;
                        const isActive = placeholderConfig[placeholder.key] !== false;
                        const value = placeholderHoverPayload[placeholder.key];
                        const hasContent = hasPlaceholderRenderableValue(value);

                        return (
                          <button
                            key={placeholder.key}
                            type="button"
                            className={`placeholder-catalog-card ${isSelected ? "selected" : ""}`}
                            style={{ animationDelay: `${index * 30}ms` }}
                            onClick={() => setCatalogPinnedPlaceholderKey(placeholder.key)}
                            onMouseEnter={() => setCatalogPinnedPlaceholderKey(placeholder.key)}
                          >
                            <div className="placeholder-catalog-card-head">
                              <span className="placeholder-tag-inline">{`{{${placeholder.key}}}`}</span>
                              <span className={`placeholder-chip ${hasContent ? "ok" : "warn"}`}>
                                {hasContent ? "Com conteúdo" : "Sem conteúdo"}
                              </span>
                            </div>
                            <strong>{placeholder.label}</strong>
                            <p>{placeholder.description}</p>
                            <div className="placeholder-catalog-card-footer">
                              <span>{placeholder.source}</span>
                              <label
                                className="toggle-row"
                                onClick={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  onChange={() => togglePlaceholder(placeholder.key)}
                                />
                                <span>{isActive ? "Ativo" : "Inativo"}</span>
                              </label>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="placeholder-catalog-empty">
                      <strong>Nenhum placeholder encontrado</strong>
                      <span>Refine a busca ou troque o filtro de origem.</span>
                    </div>
                  )}
                </article>

                <aside className="panel sticky-panel placeholder-catalog-preview">
                  {catalogPinnedPlaceholder ? (
                    <div className="placeholder-pinned-card">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Preview ativo</p>
                          <h2>{catalogPinnedPlaceholder.label}</h2>
                        </div>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void copyPlaceholderTag(catalogPinnedPlaceholder.key)}
                        >
                          {catalogCopiedPlaceholderKey === catalogPinnedPlaceholder.key ? "Tag copiada" : "Copiar tag"}
                        </button>
                      </div>

                      <div className="placeholder-chip-row">
                        <span className="placeholder-chip subtle">{`{{${catalogPinnedPlaceholder.key}}}`}</span>
                        <span className="placeholder-chip subtle">{catalogPinnedPlaceholder.type}</span>
                        {catalogPinnedPlaceholderBinding ? (
                          <span className="placeholder-chip subtle">
                            {getPlaceholderBindingLabel(catalogPinnedPlaceholderBinding)}
                          </span>
                        ) : null}
                        <span className={`placeholder-chip ${catalogPinnedPlaceholderIsActive ? "ok" : "warn"}`}>
                          {catalogPinnedPlaceholderIsActive ? "Incluído na exportação" : "Excluído da exportação"}
                        </span>
                      </div>

                      <p className="placeholder-pinned-copy">{catalogPinnedPlaceholder.description}</p>
                      <p className="mini-text">
                        {getPlaceholderBindingDescription(catalogPinnedPlaceholder)}
                      </p>

                      <div className="placeholder-catalog-toggle-card">
                        <label className="toggle-row">
                          <input
                            type="checkbox"
                            checked={catalogPinnedPlaceholderIsActive}
                            onChange={() => togglePlaceholder(catalogPinnedPlaceholder.key)}
                          />
                          <span>Incluir este placeholder na exportação DOCX</span>
                        </label>
                      </div>

                      <div className="placeholder-catalog-preview-shell">
                        <div className="placeholder-catalog-preview-header">
                          <strong>Conteúdo atual</strong>
                          <span className={`placeholder-chip ${catalogPinnedPlaceholderHasContent ? "ok" : "warn"}`}>
                            {catalogPinnedPlaceholderHasContent
                              ? "Resolvido no payload"
                              : loadingPlaceholderVisuals && catalogPinnedPlaceholder.type === "image"
                                ? "Gerando visual"
                                : "Sem valor no recorte"}
                          </span>
                        </div>
                        <PlaceholderHoverPreview
                          placeholder={catalogPinnedPlaceholder}
                          value={catalogPinnedPlaceholderValue}
                          loadingVisuals={loadingPlaceholderVisuals}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="placeholder-catalog-empty placeholder-catalog-empty-preview">
                      <strong>Nada selecionado</strong>
                      <span>Escolha um placeholder para inspecionar o valor real e a configuração.</span>
                    </div>
                  )}
                </aside>
              </section>
            ) : null}

            <div className="placeholder-visual-cache" aria-hidden="true">
              <ReportVisuals analytics={activeAnalytics} rows={filteredRows} workforce={filteredWorkforce} />
            </div>
          </>
        ) : (
          <section className="empty-state panel">
            <h2>Sem dados para a unidade selecionada</h2>
            <p className="muted">
              O recorte atual não possui respostas suficientes. Selecione outra unidade ou use a opção de todas as unidades.
            </p>
          </section>
        ) : (
          <section className="empty-state panel">
            <h2>Sem avaliação carregada</h2>
            <p className="muted">
              Importe um arquivo do sistema legado para criar a primeira avaliação na nova plataforma.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  detail
}: {
  label: string;
  value: string;
  tone: "Baixo" | "Moderado" | "Alto";
  detail?: string;
}) {
  return (
    <article className={`summary-card ${mapClassificationToPriority(tone).toLowerCase()}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportTable({
  columns,
  rows
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
}) {
  if (!rows.length) {
    return <p className="mini-text">Não há linhas consolidadas para este quadro.</p>;
  }

  return (
    <div className="table-wrap report-table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`report-table-${index}`}>
              {columns.map((column) => (
                <td key={`${index}-${column.key}`}>{String(row[column.key] ?? "-")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlaceholderHoverPreview({
  placeholder,
  value,
  loadingVisuals
}: {
  placeholder: PlaceholderDefinition;
  value: unknown;
  loadingVisuals: boolean;
}) {
  if (value === DOCX_TRANSPARENT_PIXEL) {
    return (
      <div className="placeholder-hover-copy">
        Preview visual ainda não disponível para este placeholder.
      </div>
    );
  }

  if (typeof value === "string" && value.startsWith("data:image/")) {
    return <img className="placeholder-hover-image" src={value} alt={placeholder.label} />;
  }

  if (placeholder.type === "image") {
    return (
      <div className="placeholder-hover-copy">
        {loadingVisuals ? "Gerando preview visual..." : "Preview visual disponivel quando o grafico for renderizado."}
      </div>
    );
  }

  if (Array.isArray(value)) {
    const rows = value.slice(0, 3) as Array<Record<string, unknown>>;

    if (!rows.length) {
      return <div className="placeholder-hover-copy">Nenhum item gerado para este placeholder.</div>;
    }

    const columns = Object.keys(rows[0]).slice(0, 4);

    return (
      <div className="placeholder-hover-table-wrap">
        <table className="placeholder-hover-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${placeholder.key}-${index}`}>
                {columns.map((column) => (
                  <td key={`${placeholder.key}-${index}-${column}`}>{String(row[column] ?? "-")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (value && typeof value === "object") {
    return <pre className="placeholder-hover-code">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <div className="placeholder-hover-copy">{String(value ?? "Sem conteúdo gerado.")}</div>;
}

function ActionPlanCard({ row }: { row: Record<string, string> }) {
  const classification = row.classificacao;
  const priority =
    row.prioridade === "Maxima" || row.prioridade === "Alta" || row.prioridade === "Moderada"
      ? row.prioridade
      : mapClassificationToPriority(
          classification === "Alto" || classification === "Moderado" || classification === "Baixo"
            ? classification
            : "Baixo"
        );

  return (
    <div className="recommendation-card">
      <div className="panel-header">
        <strong>{row.pergunta || "Pergunta crítica"}</strong>
        <span className={`pill ${priorityTone[priority]}`}>{row.prioridade || priority}</span>
      </div>
      <p>{row.acao || "Ação não informada."}</p>
      <small>
        {`Setores: ${row.setores_contexto || "Não informado"}. `}
        {`Prazo: ${row.prazo || "Não informado"}. `}
        {`Nível: ${row.classificacao || "Não informado"}.`}
      </small>
    </div>
  );
}

function mapClassificationToPriority(classification: "Baixo" | "Moderado" | "Alto"): Priority {
  if (classification === "Alto") return "Alta";
  if (classification === "Moderado") return "Moderada";
  return "Baixa";
}

export default App;
