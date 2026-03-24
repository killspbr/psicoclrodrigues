/**
 * PsicoRisk Engine - Centralizador de Lógica de Cálculo e Classificação de Risco
 * Versão: 1.1.0
 * Alinhado com Metodologia SECONCI / NR-01
 */

const PsicoRiskEngine = {

  thresholds: {
    LOW_MAX: 1.69,
    MOD_MIN: 1.70,
    HIGH_MIN: 2.37
  },

  /**
   * Cálculo de média simples de 1.0 a 3.0
   */
  calculateAverage(sum, total) {
    if (!total || total <= 0) return 1.0;
    const avg = sum / total;
    return Math.max(1.0, Math.min(3.0, avg));
  },

  /**
   * Cálculo a partir da distribuição de frequências (Sim, Parcialmente, Não)
   */
  calculateFromDistribution(sim, parcial, nao) {
    const total = (sim || 0) + (parcial || 0) + (nao || 0);
    if (!total) return { avg: 1.0, classification: 'Baixo' };
    
    // Pesos: Sim=1, Parcial=2, Não=3
    const sum = (sim * 1) + (parcial * 2) + (nao * 3);
    const avg = this.calculateAverage(sum, total);

    return {
      avg: avg,
      classification: this.classify(avg)
    };
  },

  /**
   * Classificação oficial com base nos thresholds de corte (1.70 / 2.37)
   */
  classify(avg) {
    const val = Number(avg) || 1.0;
    if (val >= this.thresholds.HIGH_MIN) return 'Alto';
    if (val >= this.thresholds.MOD_MIN) return 'Moderado';
    return 'Baixo';
  },

  /**
   * Mapeamento de estilos visuais (Badges/Cores) para consistência no sistema
   */
  getVisuals(avg) {
    const level = this.classify(avg);
    const mapping = {
      'Alto': {
        class: 'bg-danger-subtle text-danger',
        badge: 'badge-risk-high',
        text: 'Alto Risco',
        priority: 'Máxima'
      },
      'Moderado': {
        class: 'bg-warning-subtle text-warning-emphasis',
        badge: 'badge-risk-medium',
        text: 'Risco Moderado',
        priority: 'Alta'
      },
      'Baixo': {
        class: 'bg-success-subtle text-success',
        badge: 'badge-risk-low',
        text: 'Baixo Risco',
        priority: 'Normal'
      }
    };
    return mapping[level];
  },

  /**
   * Conversão de Score Médio (1-3) para Pontos Inteiros
   */
  convertScoreToPoints(avg, totalQuestions) {
    const questions = totalQuestions || 27;
    return avg * questions;
  },

  /**
   * Retorna o número de perguntas padrão por categoria
   */
  getCategoryQuestionCount(categoryName) {
    const counts = {
      'Metas/Demandas/Jornada de Trabalho': 7,
      'Posto de Trabalho': 2,
      'Percepção em relação  as atividades realizadas': 6,
      'Relações Interpessoais no Trabalho/Suporte/Assédio': 6,
      'Fatores Pessoais e Familiares/Sociais/Financeiros': 6
    };
    return counts[categoryName] || 6;
  },

  /**
   * Formatação amigável para exibição (ex: "54 pontos (escala 27-81)")
   */
  formatPoints(avg, totalQuestions) {
    const qCount = totalQuestions || 27;
    const pts = this.convertScoreToPoints(avg, qCount);
    const min = qCount * 1;
    const max = qCount * 3;
    const formattedPts = pts.toFixed(1).replace('.', ',');
    return `${formattedPts} pontos (escala ${min}–${max})`;
  }
};

// Exportar para Node se necessário (testes)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PsicoRiskEngine;
}
