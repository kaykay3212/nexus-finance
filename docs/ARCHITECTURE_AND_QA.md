# Nexus Finance — mapa técnico e processo de verificação

## Fonte de produção
- Branch de produção: `deploy-backend`. `main` não é a versão publicada.
- Frontend: `index.html` (estrutura e IDs), `styles.css` (layout), `app.js` (estado, navegação, formulários, dados e renderizadores).
- Analytics: `finance-analytics.js` e `dashboard-charts.js`. Projeção hipotética: `simulation.js`.
- Páginas/menu: `site-structure.js`; PWA/cache: `service-worker.js`.
- API: `backend/server.py`; migrações em `backend/migrations/`; testes em `backend/tests/`.
- Render extrai `nexus-finance-deploy.zip` antes de iniciar o backend. **Alterar só o código sem atualizar o ZIP não publica a alteração.**

## Contratos e fronteiras
- Cada seção `.page` tem ID único. Apenas a página ativa deve estar visível.
- O Dashboard tem três painéis: `summary`, `charts`, `followup`. O Assistente faz parte de `summary`, **não** é uma aba.
- A navegação móvel usa `.mobile-nav`/`.mobile-nav-items`; não criar outro menu nem múltiplos listeners para o mesmo clique.
- Scroll vertical no iPhone é nativo. Evitar `preventDefault` em `touchmove`, restauradores de scroll atrasados e múltiplas regiões concorrentes de rolagem.
- A Simulação é **somente local/hipotética**: não grava nem modifica `rows`, a API, a base de dados ou compromissos reais.
- A geração de dicas é baseada em regras locais; não tratar como IA conversacional externa.

## Antes de publicar qualquer mudança
1. Conferir `git diff` e garantir que apenas componentes previstos mudaram.
2. Rodar `python -m unittest discover -s backend/tests -t .`.
3. Rodar `python tools/check_frontend.py` e `node --check` nos JS.
4. Conferir visualmente desktop e tela estreita: Resumo, Gráficos, Acompanhar, Movimentações, Metas, Investimentos, Estatísticas, Simulação, Cripto e Binance. Verificar **primeiro gesto de rolagem após trocar de página**, barra aberta/fechada, formulários e mensagens vazias.
5. Atualizar a versão de assets no HTML e service worker quando houver mudança visual/JS; executar `python tools/build_deploy_package.py` e `--check`.
6. Checar o workflow do GitHub, disparar deploy do commit que contenha o ZIP atualizado e confirmar `live`. `live` não comprova ausência de bug de UI.
7. Se não houver teste real em Safari iOS, deixar essa limitação explícita.

## Proteção de dados
Nunca excluir contas, movimentações, metas, nem executar reset/migração destrutiva sem autorização **nova e específica**. Para corrigir UI, trabalhar apenas em código e testes. Não executar migrações antigas manualmente.

## Débitos técnicos conhecidos
- `styles.css` tem regras móveis repetidas, muitas com `!important`. Refatorar por componentes gradualmente, com comparação visual por aba.
- `app.js` centraliza muitas responsabilidades; separar módulos só após estabelecer testes de integração, evitando regressão.
- Testes estáticos não substituem navegador real, sobretudo Safari em PWA.

## Diário infinito (v1)
- Navegação configurada em `site-structure.js`, editor isolado em `diary.js` e estilos em `styles.css`.
- Páginas e traços são locais por identidade de conta e navegador; não existe sincronização entre aparelhos nesta versão.
- Validar criação e troca de páginas, título, caneta, texto, formas, linha, seta, desfazer, zoom por pinça/roda, mover com a mão e exportação PNG.
- Não misturar dados do diário com endpoints ou tabelas financeiros.
