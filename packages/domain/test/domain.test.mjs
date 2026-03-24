import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_CATEGORIES,
  TOTAL_QUESTIONS,
  DOCX_TRANSPARENT_PIXEL,
  analyzeRows,
  buildDocxTemplatePayload,
  buildReportModel,
  computeCidfAggravationFactor,
  normalizeControlMeasures
} from "../dist/index.js";

function buildRows(answerByIndex) {
  const categorySequence = [
    ...Array(7).fill(OFFICIAL_CATEGORIES[0]),
    ...Array(2).fill(OFFICIAL_CATEGORIES[1]),
    ...Array(6).fill(OFFICIAL_CATEGORIES[2]),
    ...Array(6).fill(OFFICIAL_CATEGORIES[3]),
    ...Array(6).fill(OFFICIAL_CATEGORIES[4])
  ];

  return ["Ana", "Bruno"].flatMap((name, employeeIndex) =>
    Array.from({ length: TOTAL_QUESTIONS }, (_, index) => {
      const answer = answerByIndex(index, employeeIndex);
      const answerScore = answer === "Sim" ? 1 : answer === "Parcialmente" ? 2 : 3;

      return {
        name,
        unit: "Matriz",
        department: employeeIndex === 0 ? "Operacao" : "Administrativo",
        role: employeeIndex === 0 ? "Analista" : "Assistente",
        sector: employeeIndex === 0 ? "Operacao" : "Administrativo",
        responseDate: "2026-03-21",
        category: categorySequence[index],
        question: `Pergunta ${index + 1}`,
        answer,
        answerScore
      };
    })
  );
}

test("CID F so agrava quando houve analise e relacao com o trabalho", () => {
  const inactive = normalizeControlMeasures({
    afast_cidf: {
      atende: "Nao"
    }
  });
  const noAnalysis = normalizeControlMeasures({
    afast_cidf: {
      atende: "Sim",
      afastamentosAnalisados: "Nao"
    }
  });
  const noWorkRelation = normalizeControlMeasures({
    afast_cidf: {
      atende: "Sim",
      afastamentosAnalisados: "Sim",
      relacaoComTrabalho: "Nao"
    }
  });
  const active = normalizeControlMeasures({
    afast_cidf: {
      atende: "Sim",
      afastamentosAnalisados: "Sim",
      relacaoComTrabalho: "Sim"
    }
  });

  assert.equal(computeCidfAggravationFactor(inactive), 0);
  assert.equal(computeCidfAggravationFactor(noAnalysis), 0);
  assert.equal(computeCidfAggravationFactor(noWorkRelation), 0);
  assert.equal(computeCidfAggravationFactor(active), 0.15);
});

test("payload DOCX consolida tabelas e campos derivados do CID F", () => {
  const rows = buildRows((index, employeeIndex) => {
    if (employeeIndex === 0) return "Nao";
    return index % 3 === 0 ? "Parcialmente" : "Nao";
  });

  const controlMeasures = normalizeControlMeasures({
    cipa: { atende: "Sim" },
    afast_cidf: {
      atende: "Sim",
      afastamentosAnalisados: "Sim",
      relacaoComTrabalho: "Sim"
    }
  });

  const analytics = analyzeRows(rows, controlMeasures, {
    eligibleWorkers: 2,
    respondentWorkers: 2,
    byUnit: {
      matriz: {
        eligible: 2,
        respondents: 2
      }
    }
  });

  const payload = buildDocxTemplatePayload({
    assessmentName: "Ciclo Teste",
    companyName: "Empresa Teste",
    unitName: "Matriz",
    analytics,
    controlMeasures
  });

  const criticalQuestions = analytics.questions.filter(
    (question) => question.finalClassification === "Moderado" || question.finalClassification === "Alto"
  );

  assert.equal(payload.empresa, "Empresa Teste");
  assert.equal(payload.unidade, "Matriz");
  assert.equal(payload.cidf_afastamentos_analisados, "Sim");
  assert.equal(payload.cidf_relacao_trabalho, "Sim");
  assert.ok(String(payload.cidf_grupos).includes("Relacao com o trabalho: Sim"));
  assert.ok(Array.isArray(payload.plano_acao_tabela));
  assert.ok(payload.plano_acao_tabela.length > 0);
  assert.equal(payload.plano_acao_tabela.length, criticalQuestions.length);
  assert.ok(
    criticalQuestions.every((question) =>
      payload.plano_acao_tabela.some((row) => row.pergunta === question.question)
    )
  );
  const groupedAction = payload.plano_acao_tabela.find(
    (row) => row.setores_contexto.includes("Administrativo") && row.setores_contexto.includes("Operacao")
  );
  assert.ok(groupedAction);
  assert.ok(["Moderado", "Alto"].includes(groupedAction.classificacao));
  assert.ok(groupedAction.acao);
  assert.ok(groupedAction.prazo);
  assert.ok(Array.isArray(payload.tabela_departamentos_resumo));
  assert.equal(payload.grafico_global_distribuicao, DOCX_TRANSPARENT_PIXEL);
});

test("ReportModel expõe tabelas estruturadas para relatório web e PDF", () => {
  const rows = buildRows((index) => (index % 2 === 0 ? "Nao" : "Parcialmente"));
  const controlMeasures = normalizeControlMeasures({
    cipa: { atende: "Sim" }
  });

  const analytics = analyzeRows(rows, controlMeasures, {
    eligibleWorkers: 2,
    respondentWorkers: 2,
    byUnit: {
      matriz: {
        eligible: 2,
        respondents: 2
      }
    }
  });

  const report = buildReportModel({
    assessmentName: "Ciclo Teste",
    companyName: "Empresa Teste",
    unitName: "Matriz",
    analytics,
    controlMeasures
  });

  assert.ok(Array.isArray(report.departmentSummaryTable));
  assert.ok(report.departmentSummaryTable.length > 0);
  assert.ok(Array.isArray(report.controlMeasuresTable));
  assert.ok(report.controlMeasuresTable.length > 0);
  assert.ok(Array.isArray(report.topQuestionsTable));
  assert.ok(report.topQuestionsTable.length > 0);
  assert.ok(Array.isArray(report.actionPlanTable));
  assert.ok(report.actionPlanTable.length > 0);
  assert.ok(report.actionPlanTable.every((row) => row.pergunta && row.setores_contexto && row.acao && row.prioridade && row.prazo));
});

test("Plano de acao agrupa por categoria e aplica continuidade quando so ha risco baixo", () => {
  const rows = buildRows((index) => (index < 7 ? "Parcialmente" : "Sim"));
  const controlMeasures = normalizeControlMeasures();

  const analytics = analyzeRows(rows, controlMeasures, {
    eligibleWorkers: 2,
    respondentWorkers: 2,
    byUnit: {
      matriz: {
        eligible: 2,
        respondents: 2
      }
    }
  });

  const report = buildReportModel({
    assessmentName: "Ciclo Continuidade",
    companyName: "Empresa Teste",
    unitName: "Matriz",
    analytics,
    controlMeasures
  });

  assert.equal(report.actionPlanGroups.length, OFFICIAL_CATEGORIES.length);
  assert.equal(report.actionPlanSummary.prioritizedActions, 7);
  assert.equal(report.actionPlanSummary.continuityCategories, 4);

  const firstCategoryGroup = report.actionPlanGroups.find((group) => group.category === OFFICIAL_CATEGORIES[0]);
  assert.ok(firstCategoryGroup);
  assert.equal(firstCategoryGroup.hasPrioritizedActions, true);
  assert.equal(firstCategoryGroup.rows.length, 7);

  const continuityGroups = report.actionPlanGroups.filter((group) => group.category !== OFFICIAL_CATEGORIES[0]);
  assert.equal(continuityGroups.length, 4);
  assert.ok(continuityGroups.every((group) => group.hasPrioritizedActions === false));
  assert.ok(
    continuityGroups.every((group) =>
      String(group.rows[0].acao).includes("nao foram identificadas demandas de implementacoes de novos controles")
    )
  );

  const payload = buildDocxTemplatePayload({
    assessmentName: "Ciclo Continuidade",
    companyName: "Empresa Teste",
    unitName: "Matriz",
    analytics,
    controlMeasures
  });

  assert.equal(payload.plano_acao_qtd, "7");
  assert.ok(Array.isArray(payload.plano_acao_tabela));
  assert.equal(payload.plano_acao_tabela.length, 11);
  assert.ok(
    String(payload.plano_acao_resumo).includes(
      "4 categoria(s) permaneceram somente com recomendação de continuidade"
    )
  );
});
