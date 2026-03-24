/**
 * PsicoRisk Manager - Catálogo Central de Placeholders
 * Versão: 1.2.0
 * Define todos os campos disponíveis para exportação DOCX e governança de dados.
 */

const PLACEHOLDER_CATALOG = [
  // --- CAMPOS GERAIS ---
  { key: 'empresa', label: 'Empresa', description: 'Nome da empresa avaliada', source: 'contexto', type: 'text', enabledByDefault: true },
  { key: 'unidade', label: 'Unidade', description: 'Nome da unidade/obra/setor', source: 'contexto', type: 'text', enabledByDefault: true },
  { key: 'data_relatorio', label: 'Data Relatório', description: 'Data formatada (DD/MM/AAAA)', source: 'sistema', type: 'text', enabledByDefault: true },
  { key: 'mes_relatorio', label: 'Mês Relatório', description: 'Mês por extenso', source: 'sistema', type: 'text', enabledByDefault: true },
  { key: 'ano_relatorio', label: 'Ano Relatório', description: 'Ano com 4 dígitos', source: 'sistema', type: 'text', enabledByDefault: true },
  { key: 'taxa_resposta', label: 'Taxa de Resposta', description: 'Texto com % e descrição de respondentes', source: 'relatório', type: 'text', enabledByDefault: true },
  { key: 'total_trabalhadores', label: 'Total Trabalhadores', description: 'Quantidade total de vidas ativas', source: 'dashboard', type: 'number', enabledByDefault: true },
  { key: 'total_respostas', label: 'Total Respostas', description: 'Quantidade de formulários válidos', source: 'dashboard', type: 'number', enabledByDefault: true },
  { key: 'total_perguntas', label: 'Total Perguntas', description: 'Número de questões do instrumento (ex: 27)', source: 'sistema', type: 'number', enabledByDefault: true },

  // --- RISCO GLOBAL ---
  { key: 'pontos_geral', label: 'Pontos Geral (Bruto)', description: 'Escore total (escala 27-81)', source: 'cálculo', type: 'points', enabledByDefault: true },
  { key: 'pontos_geral_atenuado', label: 'Pontos Geral (Atenuado)', description: 'Escore após medidas de controle', source: 'cálculo', type: 'points', enabledByDefault: true },
  { key: 'classif_global_bruto', label: 'Classif. Global (Bruto)', description: 'Nível de risco original', source: 'cálculo', type: 'text', enabledByDefault: true },
  { key: 'classif_global_final', label: 'Classif. Global (Final)', description: 'Nível de risco final atenuado', source: 'cálculo', type: 'text', enabledByDefault: true },
  { key: 'descricao_risco_global', label: 'Descrição Risco Global', description: 'Parágrafo explicativo do risco final', source: 'relatório', type: 'longtext', enabledByDefault: true },
  { key: 'faixas_risco_global', label: 'Faixas de Risco', description: 'Legenda dos critérios (Baixo/Mod/Alto)', source: 'metodologia', type: 'text', enabledByDefault: true },

  // --- RESUMOS TEXTUAIS ---
  { key: 'resumo_riscos_texto', label: 'Resumo de Riscos', description: 'Diagnóstico qualitativo geral', source: 'relatório', type: 'longtext', enabledByDefault: true },
  { key: 'resumo_riscos_contagens', label: 'Contagem de Riscos', description: 'Distribuição quantitativa dos riscos', source: 'relatório', type: 'text', enabledByDefault: true },
  { key: 'plano_acao_resumo', label: 'Resumo Plano Ação', description: 'Total de ações e prioridades', source: 'plano de ação', type: 'text', enabledByDefault: true },
  { key: 'responsavel_unidade', label: 'Responsável Unidade', description: 'Nome do gestor do plano', source: 'plano de ação', type: 'text', enabledByDefault: true },

  // --- MEDIDAS DE CONTROLE (SITUAÇÃO E GRUPOS) ---
  { key: 'cipa_situacao', label: 'CIPA Situacao', description: 'Status da medida', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'cipa_grupos', label: 'CIPA Grupos', description: 'Grupos afetados', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'aet_aep_situacao', label: 'AET/AEP Situacao', description: 'Status da medida', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'aet_aep_grupos', label: 'AET/AEP Grupos', description: 'Grupos afetados', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'canal_etico_situacao', label: 'Canal Ético Situacao', description: 'Status da medida', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'canal_etico_grupos', label: 'Canal Ético Grupos', description: 'Grupos afetados', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'saude_mental_situacao', label: 'Saúde Mental Situacao', description: 'Status da medida', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'saude_mental_grupos', label: 'Saúde Mental Grupos', description: 'Grupos afetados', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'treinamento_lideranca_situacao', label: 'Liderança Situacao', description: 'Status da medida', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'treinamento_lideranca_grupos', label: 'Liderança Grupos', description: 'Grupos afetados', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'cidf_situacao', label: 'CID F Situacao', description: 'Status do agravo', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'cidf_grupos', label: 'CID F Grupos', description: 'Detalhamento do agravo', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'pesquisa_clima_situacao', label: 'Clima Situacao', description: 'Status da medida', source: 'controles', type: 'text', enabledByDefault: true },
  { key: 'pesquisa_clima_grupos', label: 'Clima Grupos', description: 'Grupos afetados', source: 'controles', type: 'text', enabledByDefault: true },

  // --- GRÁFICOS GERAIS (IMAGES) ---
  { key: 'grafico_global_distribuicao', label: 'Gráfico Global (Pizza)', description: 'Distribuição geral de respostas', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_global_resumo_riscos', label: 'Gráfico Global (Resumo)', description: 'Resumo quantitativo de níveis de risco', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_taxa_resposta', label: 'Gráfico Taxa Resposta', description: 'Engajamento dos trabalhadores', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_global_comparacao_bruto_atenuado', label: 'Gráfico Comparação Bruto/Att', description: 'Impacto das medidas de controle', source: 'gráficos', type: 'image', enabledByDefault: true },

  // --- GRÁFICOS POR CATEGORIA ---
  { key: 'grafico_risco_categoria_1', label: 'Gráfico Categoria 1', description: 'Gráfico específico da cat 1', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_risco_categoria_2', label: 'Gráfico Categoria 2', description: 'Gráfico específico da cat 2', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_risco_categoria_3', label: 'Gráfico Categoria 3', description: 'Gráfico específico da cat 3', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_risco_categoria_4', label: 'Gráfico Categoria 4', description: 'Gráfico específico da cat 4', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_risco_categoria_5', label: 'Gráfico Categoria 5', description: 'Gráfico específico da cat 5', source: 'gráficos', type: 'image', enabledByDefault: true },
  
  // -- Nomes amigáveis para categorias --
  { key: 'grafico_categoria_metas', label: 'Gráfico Metas/Jornada', description: 'Visual da categoria Metas', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_categoria_posto', label: 'Gráfico Posto Trabalho', description: 'Visual da categoria Posto', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_categoria_percepcao', label: 'Gráfico Percepção Atividades', description: 'Visual da categoria Percepção', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_categoria_relacoes', label: 'Gráfico Relações/Suporte', description: 'Visual da categoria Relações', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_categoria_fatores', label: 'Gráfico Fatores Pessoais', description: 'Visual da categoria Fatores Pessoais', source: 'gráficos', type: 'image', enabledByDefault: true },

  // --- DEPARTAMENTOS ---
  { key: 'grafico_departamentos_principal', label: 'Gráfico Departamentos', description: 'Comparação de risco entre setores', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_departamentos_mini_barras', label: 'Mini Barras Departamentos', description: 'Visual simplificado por setor', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'tabela_departamentos_resumo', label: 'Tabela Departamentos', description: 'Lista de setores e escores', source: 'tabelas', type: 'table', enabledByDefault: true },

  // --- PERGUNTAS ---
  { key: 'grafico_top10_perguntas', label: 'Gráfico Top 10 Críticas', description: 'As 10 questões com maior risco', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'tabela_top10_perguntas', label: 'Tabela Top 10 Críticas', description: 'Lista detalhada das questões críticas', source: 'tabelas', type: 'table', enabledByDefault: true },
  { key: 'tabela_pergunta_departamento', label: 'Tabela Pergunta x Depto', description: 'Cruzamento de dados', source: 'tabelas', type: 'table', enabledByDefault: true },
  { key: 'grafico_heatmap_pergunta_departamento', label: 'Heatmap Pergunta/Depto', description: 'Mapa de calor de criticidade', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_treemap_pergunta_departamento', label: 'Treemap Pergunta/Depto', description: 'Proporção de riscos', source: 'gráficos', type: 'image', enabledByDefault: true },

  // --- REPRESENTATIVIDADE / DISTRIBUIÇÃO ---
  { key: 'grafico_distribuicao_escores', label: 'Curva de Distribuição', description: 'Histograma de escores individuais', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'cards_representatividade', label: 'Cards Representatividade', description: 'Visual de engajamento por setor', source: 'gráficos', type: 'image', enabledByDefault: true },

  // --- PLANO DE AÇÃO (LOOP) ---
  { key: 'plano_acao_tabela', label: 'Tabela do Plano', description: 'Lista completa de ações (Tabela DOCX)', source: 'plano de ação', type: 'table', enabledByDefault: true },
  { key: 'setores_contexto', label: 'Setores do Plano', description: 'Setores afetados no plano', source: 'plano de ação', type: 'text', enabledByDefault: true },
  { key: 'prioridade', label: 'Prioridade (Item)', description: 'Nível de prioridade da ação', source: 'plano de ação', type: 'text', enabledByDefault: false },
  { key: 'categoria', label: 'Categoria (Item)', description: 'Categoria da questão original', source: 'plano de ação', type: 'text', enabledByDefault: false },
  { key: 'acao', label: 'Ação (Item)', description: 'Descrição da recomendação', source: 'plano de ação', type: 'text', enabledByDefault: false },
  { key: 'prazo', label: 'Prazo (Item)', description: 'Tempo estimado para execução', source: 'plano de ação', type: 'text', enabledByDefault: false },
  { key: 'situacao', label: 'Situação (Item)', description: 'Status atual da recomendação', source: 'plano de ação', type: 'text', enabledByDefault: false },

  // --- ALIASES / LEGADO ---
  { key: "grafico_global_distribuicao", label: "Gráfico - Distribuição Global", type: "image", source: 'gráficos', description: 'Visual de pizza com distribuição global', enabledByDefault: true },
  { key: "grafico_resumo_risco", label: "Gráfico - Resumo Risco", type: "image", source: 'gráficos', description: 'Visual de barras com resumo de níveis', enabledByDefault: true },
  { key: "grafico_heatmap", label: "Gráfico - Heatmap", type: "image", source: 'gráficos', description: 'Mapa de calor pergunta x depto', enabledByDefault: true },
  { key: "grafico_treemap", label: "Gráfico - Treemap", type: "image", source: 'gráficos', description: 'Mapa de proporção de riscos', enabledByDefault: true },

  { key: 'grafico_response_rate_chart', label: 'Alias Taxa Resposta', description: 'Compatibilidade de template', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_distribution_chart', label: 'Alias Distribuição', description: 'Compatibilidade de template', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_risk_summary_chart', label: 'Alias Resumo Riscos', description: 'Compatibilidade de template', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_departments_chart', label: 'Alias Departamentos', description: 'Compatibilidade de template', source: 'gráficos', type: 'image', enabledByDefault: true },
  { key: 'grafico_score_distribution_chart', label: 'Alias Curva Escores', description: 'Compatibilidade de template', source: 'gráficos', type: 'image', enabledByDefault: true }
];

if (typeof window !== 'undefined') {
  window.PLACEHOLDER_CATALOG = PLACEHOLDER_CATALOG;
}
