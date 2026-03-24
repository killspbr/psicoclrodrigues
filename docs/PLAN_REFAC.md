# Plano de Melhorias e Refatoração (PsicoRisk Manager)

## Objetivo
1.  **Eliminar a tela "Início" (`index.html`)**: O sistema deve abrir diretamente no Dashboard.
2.  **Eliminar a tela "Questionário" (`questionario.html`)**: Focar apenas na análise dos dados, sem a parte de coleta integrada por enquanto.
3.  **Análise de UI/UX**: Utilizar o workflow `ui-ux-pro-max` para sugerir melhorias em todo o sistema.

## Fase 1: Limpeza e Redirecionamento
- [ ] **Ajustar `navbar.html`**: Remover os links de "Início" e "Questionário".
- [ ] **Ajustar `dashboard.html`**:
    *   Renomear `dashboard.html` para `index.html` (para ser a página inicial padrão) OU configurar um redirecionamento em `index.html`.
    *   *Decisão*: Renomear `dashboard.html` para `index.html` é o mais limpo para um protótipo estático.
- [ ] **Ajustar lógica de navegação**:
    *   Em todas as páginas (`analise-departamentos.html`, `analise-perguntas.html`, etc.), a lógica de `fetch('navbar.html')` e `window.location.pathname` deve ser atualizada para considerar o novo `index.html`.
- [ ] **Deletar arquivos obsoletos**: Remover `questionario.html` e o antigo `index.html`.

## Fase 2: Análise UI/UX (Workflow `ui-ux-pro-max`)
- [ ] **Análise de Estilo**: Definir paleta de cores, tipografia e efeitos (Glassmorphism, etc.) seguindo as recomendações do script `search.py`.
- [ ] **Auditoria de Componentes**: Avaliar cada tela (Análise de Perguntas, Departamentos, Relatório, Medidas de Controle, Plano de Ação, Metodologia) sob as diretrizes de UX Pro Max.
- [ ] **Documentação de Sugestões**: Criar um artefato detalhando as melhorias sugeridas para cada tela.

## Fase 3: Revisão e Próximos Passos
- [ ] Apresentar os resultados da análise ao usuário para aprovação antes de qualquer implementação visual.

---
**Status**: 🔵 Planejamento Concluído. Aguardando aprovação para execução parcial (Sugestões de UI/UX).
