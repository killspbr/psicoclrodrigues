import { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import Chart from "chart.js/auto";
import type { AssessmentAnalytics, InternalRow, WorkforceMeta } from "@psicorisk/domain";

interface ReportVisualsProps {
  analytics: AssessmentAnalytics;
  rows: InternalRow[];
  workforce: WorkforceMeta | null;
}

type ChartConfig = {
  type: "doughnut" | "bar" | "line";
  data: Record<string, unknown>;
  options?: Record<string, unknown>;
};

const transparentPixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

type ValueLabelMode = "value" | "percent" | "valuePercent";
type ValueLabelPlacement = "smart" | "outside" | "inside";

type ValueLabelPluginOptions = {
  display?: boolean;
  mode?: ValueLabelMode;
  placement?: ValueLabelPlacement;
  precision?: number;
  color?: string;
  backgroundColor?: string;
  offset?: number;
  fontSize?: number;
  skipZero?: boolean;
  minPercent?: number;
  lineLabelLimit?: number;
};

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function formatValueLabel(
  value: number,
  total: number,
  options: ValueLabelPluginOptions
): string {
  const precision = options.precision ?? 0;
  const normalizedValue =
    precision === 0 && Number.isInteger(value) ? String(value) : value.toFixed(precision);
  const normalizedPercent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  const mode = options.mode ?? "value";

  if (mode === "percent") return `${normalizedPercent}%`;
  if (mode === "valuePercent") return `${normalizedValue} (${normalizedPercent}%)`;
  return normalizedValue;
}

const valueLabelPlugin = {
  id: "valueLabels",
  afterDatasetsDraw(chart: Chart) {
    const pluginOptions = (chart.options.plugins as Record<string, unknown> | undefined)
      ?.valueLabels as ValueLabelPluginOptions | false | undefined;

    if (!pluginOptions || pluginOptions.display === false) return;

    const context = chart.ctx;
    const fontSize = pluginOptions.fontSize ?? 11;
    const offset = pluginOptions.offset ?? 12;
    const backgroundColor = pluginOptions.backgroundColor ?? "rgba(255, 255, 255, 0.92)";
    const color = pluginOptions.color ?? "#102033";
    const lineLabelLimit = pluginOptions.lineLabelLimit ?? 14;

    context.save();
    context.font = `600 ${fontSize}px "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      if (meta.type === "line" && meta.data.length > lineLabelLimit) return;

      const values = (Array.isArray(dataset.data) ? dataset.data : [])
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry));
      const total = values.reduce((sum, entry) => sum + entry, 0);

      meta.data.forEach((element, dataIndex) => {
        const rawValue = Number((Array.isArray(dataset.data) ? dataset.data[dataIndex] : 0) ?? 0);
        if (!Number.isFinite(rawValue)) return;
        if ((pluginOptions.skipZero ?? true) && rawValue <= 0) return;

        const percentValue = total > 0 ? (rawValue / total) * 100 : 0;
        if (meta.type === "doughnut" && percentValue < (pluginOptions.minPercent ?? 4)) return;

        const label = formatValueLabel(rawValue, total, pluginOptions);
        const tooltipPosition = (element as unknown as {
          tooltipPosition: (useFinalPosition?: boolean) => { x: number | null; y: number | null };
        }).tooltipPosition(true);
        let x = tooltipPosition.x ?? 0;
        let y = tooltipPosition.y ?? 0;

        if (meta.type === "bar") {
          y -= offset;
        } else if (meta.type === "line") {
          y -= offset;
        } else if (meta.type === "doughnut") {
          const arc = element as unknown as {
            startAngle: number;
            endAngle: number;
            innerRadius: number;
            outerRadius: number;
            x: number;
            y: number;
          };
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const placement = pluginOptions.placement ?? "smart";
          const insideRadius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) / 2;
          const outsideRadius = arc.outerRadius + offset;
          const radius =
            placement === "inside"
              ? insideRadius
              : placement === "outside"
                ? outsideRadius
                : percentValue < 10
                  ? outsideRadius
                  : insideRadius;
          x = arc.x + Math.cos(angle) * radius;
          y = arc.y + Math.sin(angle) * radius;
        }

        const textWidth = context.measureText(label).width;
        const boxWidth = textWidth + 12;
        const boxHeight = fontSize + 8;
        const chartArea = chart.chartArea;

        x = Math.max(chartArea.left + boxWidth / 2 + 4, Math.min(x, chartArea.right - boxWidth / 2 - 4));
        y = Math.max(chartArea.top + boxHeight / 2 + 4, Math.min(y, chartArea.bottom - boxHeight / 2 - 4));

        context.fillStyle = backgroundColor;
        drawRoundedRect(context, x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 8);
        context.fill();

        context.fillStyle = color;
        context.fillText(label, x, y + 0.5);
      });
    });

    context.restore();
  }
};

Chart.register(valueLabelPlugin);

function ChartCanvas({ chartId, config, height = 220 }: { chartId: string; config: ChartConfig; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const chart = new Chart(context, {
      type: config.type,
      data: config.data as never,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        ...(config.options ?? {})
      }
    });

    return () => chart.destroy();
  }, [config]);

  return (
    <div className="chart-shell" style={{ height }}>
      <canvas id={chartId} ref={canvasRef} />
    </div>
  );
}

function percent(value: number, total: number): string {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function quantile(sortedValues: number[], ratio: number): number {
  if (!sortedValues.length) return 0;
  const position = (sortedValues.length - 1) * ratio;
  const base = Math.floor(position);
  const rest = position - base;
  const lower = sortedValues[base] ?? sortedValues[sortedValues.length - 1];
  const upper = sortedValues[base + 1] ?? lower;
  return lower + rest * (upper - lower);
}

function buildRepresentativity(rows: InternalRow[]) {
  const scoreByEmployee = new Map<string, number>();

  rows.forEach((row) => {
    scoreByEmployee.set(row.name, (scoreByEmployee.get(row.name) ?? 0) + row.answerScore);
  });

  const values = Array.from(scoreByEmployee.values());
  if (!values.length) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const median =
    count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

  const frequencies = new Map<number, number>();
  sorted.forEach((value) => {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  });
  const maxFrequency = Math.max(...frequencies.values());
  const modes = Array.from(frequencies.entries())
    .filter(([, frequency]) => frequency === maxFrequency)
    .map(([value]) => value)
    .sort((left, right) => left - right);

  const logValues = sorted.filter((value) => value > 0).map((value) => Math.log(value));
  const logMean = logValues.reduce((sum, value) => sum + value, 0) / logValues.length;
  const geoMean = Math.exp(logMean);
  const logVariance = logValues.reduce((sum, value) => sum + (value - logMean) ** 2, 0) / logValues.length;
  const geoStdDev = Math.exp(Math.sqrt(logVariance));

  return {
    employeeCount: count,
    sorted,
    labels: sorted.map((_, index) => `#${index + 1}`),
    mean,
    median,
    modes,
    stdDev,
    geoMean,
    geoStdDev,
    min,
    max,
    q1,
    q3,
    iqr,
    cv
  };
}

function buildHeatmapData(rows: InternalRow[], analytics: AssessmentAnalytics) {
  const topQuestions = analytics.questions.slice(0, 6);
  const departments = analytics.departments.slice(0, 6);

  const matrix = topQuestions.map((question) => {
    const cells = departments.map((department) => {
      const scopedRows = rows.filter(
        (row) => row.department === department.department && row.question === question.question
      );
      const noCount = scopedRows.filter((row) => row.answer === "Nao").length;
      return {
        department: department.department,
        rate: scopedRows.length ? (noCount / scopedRows.length) * 100 : 0,
        count: noCount
      };
    });

    return {
      question: question.question,
      cells
    };
  });

  return {
    questions: topQuestions,
    departments,
    matrix
  };
}

function buildTreemapPairs(rows: InternalRow[]) {
  const counts = new Map<string, number>();

  rows
    .filter((row) => row.answer === "Nao")
    .forEach((row) => {
      const key = `${row.department}::${row.question}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [department, question] = key.split("::");
      return { department, question, count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function renderToDataUrl(element: HTMLElement | null): Promise<string> {
  if (!element) return Promise.resolve(transparentPixel);

  if (element instanceof HTMLCanvasElement) {
    try {
      return Promise.resolve(element.toDataURL("image/png"));
    } catch {
      return Promise.resolve(transparentPixel);
    }
  }

  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2
  })
    .then((canvas) => canvas.toDataURL("image/png"))
    .catch(() => transparentPixel);
}

function waitForVisualReady(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 180);
      });
    });
  });
}

export async function captureReportVisualPayload(): Promise<Record<string, string>> {
  await waitForVisualReady();
  const categoryPayload: Record<string, string> = {};

  for (let index = 0; index < 5; index += 1) {
    categoryPayload[`grafico_risco_categoria_${index + 1}`] = await renderToDataUrl(
      document.getElementById(`rep-category-${index}`) as HTMLCanvasElement | null
    );
  }

  return {
    grafico_global_distribuicao: await renderToDataUrl(document.getElementById("repDistributionChart") as HTMLCanvasElement | null),
    grafico_global_resumo_riscos: await renderToDataUrl(document.getElementById("repRiskSummaryChart") as HTMLCanvasElement | null),
    grafico_taxa_resposta: await renderToDataUrl(document.getElementById("rep-response-rate-chart") as HTMLCanvasElement | null),
    grafico_global_comparacao_bruto_atenuado: await renderToDataUrl(
      document.getElementById("rep-global-comparison-chart") as HTMLCanvasElement | null
    ),
    grafico_departamentos_principal: await renderToDataUrl(document.getElementById("rep-departments-chart") as HTMLCanvasElement | null),
    grafico_departamentos_mini_barras: await renderToDataUrl(document.getElementById("rep-departments-mini") as HTMLElement | null),
    grafico_top10_perguntas: await renderToDataUrl(document.getElementById("rep-questions-table-wrap") as HTMLElement | null),
    tabela_top10_perguntas: await renderToDataUrl(document.getElementById("rep-questions-table-wrap") as HTMLElement | null),
    tabela_pergunta_departamento: await renderToDataUrl(document.getElementById("rep-question-dept-heatmap") as HTMLElement | null),
    grafico_heatmap_pergunta_departamento: await renderToDataUrl(document.getElementById("rep-question-dept-heatmap") as HTMLElement | null),
    grafico_treemap_pergunta_departamento: await renderToDataUrl(document.getElementById("rep-question-dept-treemap") as HTMLElement | null),
    cards_representatividade: await renderToDataUrl(document.getElementById("rep-representativity-cards") as HTMLElement | null),
    grafico_distribuicao_escores: await renderToDataUrl(document.getElementById("rep-score-distribution-chart") as HTMLCanvasElement | null),
    grafico_resumo_risco: await renderToDataUrl(document.getElementById("repRiskSummaryChart") as HTMLCanvasElement | null),
    grafico_heatmap: await renderToDataUrl(document.getElementById("rep-question-dept-heatmap") as HTMLElement | null),
    grafico_treemap: await renderToDataUrl(document.getElementById("rep-question-dept-treemap") as HTMLElement | null),
    grafico_response_rate_chart: await renderToDataUrl(document.getElementById("rep-response-rate-chart") as HTMLCanvasElement | null),
    grafico_distribution_chart: await renderToDataUrl(document.getElementById("repDistributionChart") as HTMLCanvasElement | null),
    grafico_risk_summary_chart: await renderToDataUrl(document.getElementById("repRiskSummaryChart") as HTMLCanvasElement | null),
    grafico_departments_chart: await renderToDataUrl(document.getElementById("rep-departments-chart") as HTMLCanvasElement | null),
    grafico_score_distribution_chart: await renderToDataUrl(document.getElementById("rep-score-distribution-chart") as HTMLCanvasElement | null),
    ...categoryPayload,
    grafico_categoria_metas: categoryPayload.grafico_risco_categoria_1 ?? transparentPixel,
    grafico_categoria_posto: categoryPayload.grafico_risco_categoria_2 ?? transparentPixel,
    grafico_categoria_percepcao: categoryPayload.grafico_risco_categoria_3 ?? transparentPixel,
    grafico_categoria_relacoes: categoryPayload.grafico_risco_categoria_4 ?? transparentPixel,
    grafico_categoria_fatores: categoryPayload.grafico_risco_categoria_5 ?? transparentPixel
  };
}

export function ReportVisuals({ analytics, rows, workforce }: ReportVisualsProps) {
  const answerCounts = rows.reduce(
    (accumulator, row) => {
      if (row.answer === "Sim") accumulator.sim += 1;
      if (row.answer === "Parcialmente") accumulator.parcialmente += 1;
      if (row.answer === "Nao") accumulator.nao += 1;
      return accumulator;
    },
    { sim: 0, parcialmente: 0, nao: 0 }
  );

  const questionRiskCounts = analytics.questions.reduce(
    (accumulator, question) => {
      if (question.finalClassification === "Baixo") accumulator.low += 1;
      if (question.finalClassification === "Moderado") accumulator.moderate += 1;
      if (question.finalClassification === "Alto") accumulator.high += 1;
      return accumulator;
    },
    { low: 0, moderate: 0, high: 0 }
  );

  const representativity = buildRepresentativity(rows);
  const heatmap = buildHeatmapData(rows, analytics);
  const treemapPairs = buildTreemapPairs(rows);
  const respondentCount = workforce?.respondentWorkers ?? analytics.summary.employeeCount;
  const eligibleCount = workforce?.eligibleWorkers ?? analytics.summary.eligibleWorkers ?? respondentCount;
  const unansweredCount = Math.max(0, eligibleCount - respondentCount);

  return (
    <>
      <section className="report-section report-page-break-before report-page-break-avoid">
        <h2>Graficos Principais</h2>
        <div className="report-charts-grid">
          <article className="report-card">
            <h3>Distribuicao Global</h3>
            <ChartCanvas
              chartId="repDistributionChart"
              config={{
                type: "doughnut",
                data: {
                  labels: ["Baixo (Sim)", "Moderado (Parcial.)", "Alto (Nao)"],
                  datasets: [
                    {
                      data: [answerCounts.sim, answerCounts.parcialmente, answerCounts.nao],
                      backgroundColor: ["#22c55e", "#eab308", "#ef4444"]
                    }
                  ]
                },
                options: {
                  plugins: {
                    legend: {
                      position: "bottom"
                    },
                    valueLabels: {
                      display: true,
                      mode: "valuePercent",
                      minPercent: 3,
                      placement: "smart"
                    }
                  },
                  layout: {
                    padding: {
                      top: 8,
                      bottom: 4
                    }
                  }
                }
              }}
            />
          </article>

          <article className="report-card">
            <h3>Resumo de Riscos</h3>
            <ChartCanvas
              chartId="repRiskSummaryChart"
              config={{
                type: "bar",
                data: {
                  labels: ["Baixo", "Moderado", "Alto"],
                  datasets: [
                    {
                      data: [questionRiskCounts.low, questionRiskCounts.moderate, questionRiskCounts.high],
                      backgroundColor: ["#22c55e", "#eab308", "#ef4444"]
                    }
                  ]
                },
                options: {
                  plugins: {
                    legend: { display: false },
                    valueLabels: {
                      display: true,
                      mode: "value"
                    }
                  }
                }
              }}
            />
          </article>

          <article className="report-card">
            <h3>Comparacao Global</h3>
            <ChartCanvas
              chartId="rep-global-comparison-chart"
              config={{
                type: "bar",
                data: {
                  labels: ["Bruto", "Atenuado", "Final"],
                  datasets: [
                    {
                      label: "Media",
                      data: [
                        Number(analytics.summary.rawAverage.toFixed(2)),
                        Number(analytics.summary.attenuatedAverage.toFixed(2)),
                        Number(analytics.summary.finalAverage.toFixed(2))
                      ],
                      backgroundColor: ["#94a3b8", "#0ea5e9", "#173c71"]
                    }
                  ]
                },
                options: {
                  scales: {
                    y: {
                      min: 0,
                      max: 3
                    }
                  },
                  plugins: {
                    legend: { display: false },
                    valueLabels: {
                      display: true,
                      mode: "value",
                      precision: 2
                    }
                  }
                }
              }}
            />
          </article>

          <article className="report-card">
            <h3>Taxa de Resposta</h3>
            <ChartCanvas
              chartId="rep-response-rate-chart"
              config={{
                type: "doughnut",
                data: {
                  labels: ["Responderam", "Nao responderam"],
                  datasets: [
                    {
                      data: [respondentCount, unansweredCount],
                      backgroundColor: ["#0ea5e9", "#dbe4f0"]
                    }
                  ]
                },
                options: {
                  plugins: {
                    legend: {
                      position: "bottom"
                    },
                    valueLabels: {
                      display: true,
                      mode: "valuePercent",
                      minPercent: 3,
                      placement: "smart"
                    }
                  },
                  layout: {
                    padding: {
                      top: 8,
                      bottom: 4
                    }
                  }
                }
              }}
            />
            <p className="mini-text">{percent(respondentCount, eligibleCount)} de participacao da base elegivel.</p>
          </article>
        </div>
      </section>

      <section className="report-section report-page-break-before report-page-break-avoid">
        <h2>Risco por Categoria</h2>
        <div className="category-visual-grid">
          {analytics.categories.slice(0, 5).map((category, index) => (
            <article key={category.category} className="report-card category-card">
              <div>
                <strong>{category.category}</strong>
                <div className="mini-text">{category.attenuatedPoints}</div>
              </div>
              <ChartCanvas
                chartId={`rep-category-${index}`}
                height={170}
                config={{
                  type: "doughnut",
                  data: {
                    labels: ["Sim", "Parcialmente", "Nao"],
                    datasets: [
                      {
                        data: [category.counts.sim, category.counts.parcialmente, category.counts.nao],
                        backgroundColor: ["#22c55e", "#eab308", "#ef4444"]
                      }
                    ]
                  },
                  options: {
                    plugins: {
                      legend: { display: false },
                      valueLabels: {
                        display: true,
                        mode: "valuePercent",
                        minPercent: 4,
                        placement: "smart",
                        fontSize: 10
                      }
                    }
                  }
                }}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="report-section report-page-break-before report-page-break-avoid">
        <h2>Departamentos</h2>
        <div className="report-grid">
          <article className="report-card">
            <h3>Grafico Principal</h3>
            <ChartCanvas
              chartId="rep-departments-chart"
              config={{
                type: "bar",
                data: {
                  labels: analytics.departments.slice(0, 8).map((department) => department.department),
                  datasets: [
                    {
                      label: "Media Final",
                      data: analytics.departments.slice(0, 8).map((department) => Number(department.finalAverage.toFixed(2))),
                      backgroundColor: "#275eb4"
                    }
                  ]
                },
                options: {
                  plugins: {
                    legend: { display: false },
                    valueLabels: {
                      display: true,
                      mode: "value",
                      precision: 2
                    }
                  }
                }
              }}
            />
          </article>

          <article className="report-card">
            <h3>Mini Barras</h3>
            <div id="rep-departments-mini" className="mini-bars">
              {analytics.departments.slice(0, 8).map((department) => (
                <div key={department.department} className="mini-bar-row">
                  <span>{department.department}</span>
                  <div className="mini-bar-track">
                    <div
                      className="mini-bar-fill"
                      style={{ width: `${Math.min(100, (department.finalAverage / 3) * 100)}%` }}
                    />
                  </div>
                  <strong>{department.finalAverage.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="report-section report-page-break-before report-page-break-avoid" id="rep-section-question-dept">
        <h2>Perguntas x Departamento</h2>
        <div className="table-wrap report-capture-surface" id="rep-questions-table-wrap">
          <table id="rep-questions-table">
            <thead>
              <tr>
                <th>Pergunta</th>
                <th>Categoria</th>
                <th>Media Final</th>
                <th>Risco</th>
              </tr>
            </thead>
            <tbody>
              {analytics.questions.slice(0, 10).map((question) => (
                <tr key={`${question.category}-${question.question}`}>
                  <td>{question.question}</td>
                  <td>{question.category}</td>
                  <td>{question.finalAverage.toFixed(2)}</td>
                  <td>{question.finalClassification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="heatmap-grid report-capture-surface" id="rep-question-dept-heatmap">
          <table className="heatmap-table">
            <thead id="rep-question-dept-heatmap-head">
              <tr>
                <th>Pergunta</th>
                {heatmap.departments.map((department) => (
                  <th key={department.department}>{department.department}</th>
                ))}
              </tr>
            </thead>
            <tbody id="rep-question-dept-heatmap-body">
              {heatmap.matrix.map((row) => (
                <tr key={row.question}>
                  <td>{row.question}</td>
                  {row.cells.map((cell) => (
                    <td
                      key={`${row.question}-${cell.department}`}
                      style={{ background: `rgba(214, 66, 55, ${Math.max(0.08, cell.rate / 100)})` }}
                    >
                      {cell.rate.toFixed(0)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div id="rep-question-dept-treemap" className="treemap-grid report-capture-surface">
          {treemapPairs.map((item) => (
            <div key={`${item.department}-${item.question}`} className="treemap-item">
              <strong>{item.department}</strong>
              <span>{item.question}</span>
              <em>{item.count} respostas "Nao"</em>
            </div>
          ))}
        </div>
      </section>

      <section className="report-section report-page-break-before report-page-break-avoid" id="rep-section-representativity">
        <h2>Representatividade dos Dados</h2>
        <div id="rep-representativity-cards" className="representativity-cards">
          <article className="report-card">
            <span className="mini-text">Respondentes</span>
            <strong>{analytics.summary.employeeCount}</strong>
            <small className="mini-text">Amostra valida do recorte atual</small>
          </article>
          <article className="report-card">
            <span className="mini-text">Centro da distribuicao</span>
            <strong>{representativity ? `${representativity.mean.toFixed(1)} pts` : "-"}</strong>
            <small className="mini-text">
              {representativity ? `Mediana ${representativity.median.toFixed(1)} pts` : "Sem calculo"}
            </small>
          </article>
          <article className="report-card">
            <span className="mini-text">Dispersao</span>
            <strong>{representativity ? `${representativity.stdDev.toFixed(2)} pts` : "-"}</strong>
            <small className="mini-text">
              {representativity ? `CV ${representativity.cv.toFixed(1)}%` : "Sem calculo"}
            </small>
          </article>
          <article className="report-card">
            <span className="mini-text">Faixa central</span>
            <strong>
              {representativity ? `${representativity.q1.toFixed(1)} a ${representativity.q3.toFixed(1)}` : "-"}
            </strong>
            <small className="mini-text">
              {representativity ? `Min ${representativity.min} | Max ${representativity.max}` : "Sem calculo"}
            </small>
          </article>
        </div>

        {representativity ? (
          <>
            <ChartCanvas
              chartId="rep-score-distribution-chart"
              height={320}
              config={{
                type: "line",
                data: {
                  labels: representativity.labels,
                  datasets: [
                    {
                      label: "+1σ",
                      data: representativity.labels.map(() => representativity.mean + representativity.stdDev),
                      borderColor: "rgba(107, 114, 128, 0.45)",
                      borderDash: [6, 4],
                      pointRadius: 0,
                      borderWidth: 1.2,
                      fill: false
                    },
                    {
                      label: "-1σ",
                      data: representativity.labels.map(() => Math.max(0, representativity.mean - representativity.stdDev)),
                      borderColor: "rgba(107, 114, 128, 0.1)",
                      pointRadius: 0,
                      borderWidth: 1,
                      fill: "-1",
                      backgroundColor: "rgba(39, 94, 180, 0.12)"
                    },
                    {
                      label: "Pontuacoes ordenadas",
                      data: representativity.sorted,
                      borderColor: "#173c71",
                      backgroundColor: "rgba(39, 94, 180, 0.12)",
                      pointRadius: 2,
                      pointHoverRadius: 4,
                      borderWidth: 2.2,
                      fill: false,
                      tension: 0.22
                    },
                    {
                      label: "Media",
                      data: representativity.labels.map(() => representativity.mean),
                      borderColor: "#d64237",
                      pointRadius: 0,
                      borderWidth: 1.4,
                      borderDash: [3, 3],
                      fill: false
                    },
                    {
                      label: "Mediana",
                      data: representativity.labels.map(() => representativity.median),
                      borderColor: "#eab308",
                      pointRadius: 0,
                      borderWidth: 1.4,
                      borderDash: [10, 4],
                      fill: false
                    }
                  ]
                },
                options: {
                  plugins: {
                    legend: {
                      position: "bottom"
                    }
                  }
                }
              }}
            />

            <div className="representativity-note" id="rep-representativity-notes">
              <strong>Leitura tecnica.</strong>{" "}
              {representativity.cv <= 15
                ? "Os escores estao relativamente concentrados, sugerindo padrao mais homogeneo entre respondentes."
                : representativity.cv <= 30
                  ? "Ha dispersao moderada dos escores, com variabilidade relevante entre grupos e individuos."
                  : "A dispersao e alta, indicando heterogeneidade acentuada na experiencia psicossocial da amostra."}{" "}
              Moda: {representativity.modes.map((value) => value.toFixed(1)).join(", ")} pts.{" "}
              Media geometrica: {representativity.geoMean.toFixed(1)} pts.
            </div>
          </>
        ) : (
          <p className="mini-text">Nao ha dados suficientes para calcular representatividade.</p>
        )}
      </section>
    </>
  );
}
