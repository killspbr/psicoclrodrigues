export interface PlaceholderDefinition {
  key: string;
  label: string;
  description: string;
  source: string;
  type: "text" | "longtext" | "number" | "points" | "image" | "table";
  enabledByDefault: boolean;
}

export type PlaceholderBinding = "direct" | "table" | "table_column" | "visual_capture" | "visual_alias";

export const PLACEHOLDER_STORAGE_KEY = "psicorisk_placeholders_config_v1";
export const PLACEHOLDER_TABLE_COLUMN_KEYS = ["pergunta", "setores_contexto", "acao", "prioridade", "prazo"] as const;
export const PLACEHOLDER_VISUAL_ALIAS_KEYS = [
  "grafico_resumo_risco",
  "grafico_heatmap",
  "grafico_treemap",
  "grafico_response_rate_chart",
  "grafico_distribution_chart",
  "grafico_risk_summary_chart",
  "grafico_departments_chart",
  "grafico_score_distribution_chart"
] as const;

export const PLACEHOLDER_CATALOG: PlaceholderDefinition[] = [
  { key: "empresa", label: "Empresa", description: "Nome da empresa avaliada", source: "contexto", type: "text", enabledByDefault: true },
  { key: "unidade", label: "Unidade", description: "Nome da unidade selecionada", source: "contexto", type: "text", enabledByDefault: true },
  { key: "data_relatorio", label: "Data Relatório", description: "Data formatada do documento", source: "sistema", type: "text", enabledByDefault: true },
  { key: "mes_relatorio", label: "Mês Relatório", description: "Mês de emissão do relatório", source: "sistema", type: "text", enabledByDefault: true },
  { key: "ano_relatorio", label: "Ano Relatório", description: "Ano da emissão do relatório", source: "sistema", type: "text", enabledByDefault: true },
  { key: "taxa_resposta", label: "Taxa de Resposta", description: "Percentual de engajamento da amostra", source: "relatório", type: "text", enabledByDefault: true },
  { key: "total_trabalhadores", label: "Total de Trabalhadores", description: "Quantidade elegível na base", source: "dashboard", type: "number", enabledByDefault: true },
  { key: "total_respostas", label: "Total de Respostas", description: "Respostas válidas consideradas", source: "dashboard", type: "number", enabledByDefault: true },
  { key: "total_perguntas", label: "Total Perguntas", description: "Quantidade de perguntas do instrumento", source: "sistema", type: "number", enabledByDefault: true },
  { key: "pontos_geral", label: "Pontos Gerais", description: "Escore bruto consolidado", source: "cálculo", type: "points", enabledByDefault: true },
  { key: "pontos_geral_atenuado", label: "Pontos Gerais Atenuados", description: "Escore após medidas de controle", source: "cálculo", type: "points", enabledByDefault: true },
  { key: "classif_global_bruto", label: "Classificação Global Bruta", description: "Nível bruto de risco", source: "cálculo", type: "text", enabledByDefault: true },
  { key: "classif_global_final", label: "Classificação Global Final", description: "Nível final de risco", source: "cálculo", type: "text", enabledByDefault: true },
  { key: "descricao_risco_global", label: "Descrição Risco Global", description: "Texto explicativo do risco final", source: "relatório", type: "longtext", enabledByDefault: true },
  { key: "faixas_risco_global", label: "Faixas de Risco", description: "Legenda metodológica de classificação", source: "metodologia", type: "text", enabledByDefault: true },
  { key: "resumo_riscos_texto", label: "Resumo de Riscos", description: "Diagnóstico qualitativo consolidado", source: "relatório", type: "longtext", enabledByDefault: true },
  { key: "resumo_riscos_contagens", label: "Contagem de Riscos", description: "Distribuição percentual dos níveis", source: "relatório", type: "text", enabledByDefault: true },
  { key: "plano_acao_resumo", label: "Resumo Plano de Ação", description: "Resumo quantitativo das recomendações", source: "plano de ação", type: "text", enabledByDefault: true },
  { key: "responsavel_unidade", label: "Responsável Unidade", description: "Responsável pelo plano de ação", source: "plano de ação", type: "text", enabledByDefault: true },
  { key: "cipa_situacao", label: "CIPA Situação", description: "Existência da medida na empresa", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "cipa_grupos", label: "CIPA Grupos", description: "Grupos impactados pela medida", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "aet_aep_situacao", label: "AET/AEP Situação", description: "Existência da medida na empresa", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "aet_aep_grupos", label: "AET/AEP Grupos", description: "Grupos impactados pela medida", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "canal_etico_situacao", label: "Canal Ético Situação", description: "Existência da medida na empresa", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "canal_etico_grupos", label: "Canal Ético Grupos", description: "Grupos impactados pela medida", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "saude_mental_situacao", label: "Saúde Mental Situação", description: "Existência da medida na empresa", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "saude_mental_grupos", label: "Saúde Mental Grupos", description: "Grupos impactados pela medida", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "treinamento_lideranca_situacao", label: "Treinamento Liderança Situação", description: "Existência da medida na empresa", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "treinamento_lideranca_grupos", label: "Treinamento Liderança Grupos", description: "Grupos impactados pela medida", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "cidf_situacao", label: "CID F Situação", description: "Presença de afastamento CID F", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "cidf_grupos", label: "CID F Grupos", description: "Escopo do agravamento CID F", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "cidf_afastamentos_analisados", label: "CID F Afastamentos Analisados", description: "Indica se os afastamentos foram analisados", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "cidf_relacao_trabalho", label: "CID F Relação com Trabalho", description: "Indica se foi identificada relação com o trabalho", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "pesquisa_clima_situacao", label: "Pesquisa de Clima Situação", description: "Existência da medida na empresa", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "pesquisa_clima_grupos", label: "Pesquisa de Clima Grupos", description: "Grupos impactados pela medida", source: "medidas de controle", type: "text", enabledByDefault: true },
  { key: "grafico_global_distribuicao", label: "Gráfico Distribuição Global", description: "Pizza global de respostas", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_global_resumo_riscos", label: "Gráfico Resumo de Riscos", description: "Resumo de risco em barras", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_taxa_resposta", label: "Gráfico Taxa Resposta", description: "Engajamento da base por unidade", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_global_comparacao_bruto_atenuado", label: "Gráfico Comparação Bruto Atenuado", description: "Comparativo entre risco bruto e atenuado", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_risco_categoria_1", label: "Gráfico Categoria 1", description: "Gráfico da primeira categoria", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_risco_categoria_2", label: "Gráfico Categoria 2", description: "Gráfico da segunda categoria", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_risco_categoria_3", label: "Gráfico Categoria 3", description: "Gráfico da terceira categoria", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_risco_categoria_4", label: "Gráfico Categoria 4", description: "Gráfico da quarta categoria", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_risco_categoria_5", label: "Gráfico Categoria 5", description: "Gráfico da quinta categoria", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_categoria_metas", label: "Gráfico Categoria Metas", description: "Visual da categoria metas", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_categoria_posto", label: "Gráfico Categoria Posto", description: "Visual da categoria posto", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_categoria_percepcao", label: "Gráfico Categoria Percepção", description: "Visual da categoria percepção", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_categoria_relacoes", label: "Gráfico Categoria Relações", description: "Visual da categoria relações", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_categoria_fatores", label: "Gráfico Categoria Fatores", description: "Visual da categoria fatores", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_departamentos_principal", label: "Gráfico Departamentos", description: "Comparativo de risco entre departamentos", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_departamentos_mini_barras", label: "Mini Barras Departamentos", description: "Resumo visual de departamentos", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "tabela_departamentos_resumo", label: "Tabela Departamentos", description: "Tabela resumo de departamentos", source: "tabelas", type: "table", enabledByDefault: true },
  { key: "grafico_top10_perguntas", label: "Gráfico Top 10 Perguntas", description: "Tabela ou visual das perguntas críticas", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "tabela_top10_perguntas", label: "Tabela Top 10 Perguntas", description: "Tabela detalhada das perguntas críticas", source: "tabelas", type: "table", enabledByDefault: true },
  { key: "tabela_pergunta_departamento", label: "Tabela Pergunta x Departamento", description: "Cruza perguntas sem baixo risco com departamentos", source: "tabelas", type: "table", enabledByDefault: true },
  { key: "grafico_heatmap_pergunta_departamento", label: "Heatmap Pergunta x Departamento", description: "Mapa de calor de criticidade", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_treemap_pergunta_departamento", label: "Treemap Pergunta x Departamento", description: "Treemap com volume de não por cruzamento", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_distribuicao_escores", label: "Distribuição de Escores", description: "Curva de dispersão dos escores individuais", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "cards_representatividade", label: "Cards Representatividade", description: "Cards estatísticos da representatividade", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "plano_acao_tabela", label: "Tabela Plano de Ação", description: "Tabela principal das ações sugeridas", source: "plano de ação", type: "table", enabledByDefault: true },
  { key: "setores_contexto", label: "Setores do Plano", description: "Setores impactados no plano", source: "plano de ação", type: "text", enabledByDefault: true },
  { key: "pergunta", label: "Pergunta do Plano", description: "Pergunta crítica que originou a ação", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "prioridade", label: "Prioridade", description: "Prioridade do item de plano", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "categoria", label: "Categoria", description: "Categoria do item de plano", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "acao", label: "Ação", description: "Ação do item de plano", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "prazo", label: "Prazo", description: "Prazo do item de plano", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "classificacao", label: "Nível do Plano", description: "Nível de risco consolidado da pergunta", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "situacao", label: "Situação", description: "Situação do item de plano", source: "plano de ação", type: "text", enabledByDefault: false },
  { key: "grafico_resumo_risco", label: "Alias Resumo de Risco", description: "Alias do gráfico resumo de risco", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_heatmap", label: "Alias Heatmap", description: "Alias do heatmap pergunta x departamento", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_treemap", label: "Alias Treemap", description: "Alias do treemap pergunta x departamento", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_response_rate_chart", label: "Alias Taxa de Resposta", description: "Alias do gráfico de taxa de resposta", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_distribution_chart", label: "Alias Distribuição", description: "Alias do gráfico de distribuição", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_risk_summary_chart", label: "Alias Risk Summary", description: "Alias do gráfico resumo", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_departments_chart", label: "Alias Departamentos", description: "Alias do gráfico principal de departamentos", source: "gráficos", type: "image", enabledByDefault: true },
  { key: "grafico_score_distribution_chart", label: "Alias Distribuição de Escores", description: "Alias do gráfico de representatividade", source: "gráficos", type: "image", enabledByDefault: true }
];

export function ensurePlaceholderConfig(saved?: Record<string, boolean> | null): Record<string, boolean> {
  const nextConfig: Record<string, boolean> = { ...(saved ?? {}) };

  for (const placeholder of PLACEHOLDER_CATALOG) {
    if (nextConfig[placeholder.key] === undefined) {
      nextConfig[placeholder.key] = placeholder.enabledByDefault;
    }
  }

  return nextConfig;
}

export function getPlaceholderBinding(placeholder: PlaceholderDefinition): PlaceholderBinding {
  if ((PLACEHOLDER_TABLE_COLUMN_KEYS as readonly string[]).includes(placeholder.key)) {
    return "table_column";
  }

  if (placeholder.type === "table") {
    return "table";
  }

  if (placeholder.type === "image") {
    return (PLACEHOLDER_VISUAL_ALIAS_KEYS as readonly string[]).includes(placeholder.key)
      ? "visual_alias"
      : "visual_capture";
  }

  return "direct";
}

export function getPlaceholderBindingLabel(binding: PlaceholderBinding): string {
  const labels: Record<PlaceholderBinding, string> = {
    direct: "Campo direto",
    table: "Tabela",
    table_column: "Coluna de tabela",
    visual_capture: "Gráfico capturado",
    visual_alias: "Alias visual"
  };

  return labels[binding];
}

export function getPlaceholderBindingDescription(placeholder: PlaceholderDefinition): string {
  const binding = getPlaceholderBinding(placeholder);

  if (binding === "table_column") {
    return "Derivado das linhas de plano_acao_tabela.";
  }

  if (binding === "table") {
    return "Gerado como estrutura tabular no payload.";
  }

  if (binding === "visual_alias") {
    return "Alias que reutiliza um gráfico já capturado no relatório.";
  }

  if (binding === "visual_capture") {
    return "Imagem gerada por captura do relatório renderizado.";
  }

  return "Valor direto do payload textual ou numérico.";
}

export function filterDocxPayload(
  payload: Record<string, unknown>,
  config: Record<string, boolean>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (config[key] !== false) {
      filtered[key] = value;
    }
  });

  return filtered;
}
