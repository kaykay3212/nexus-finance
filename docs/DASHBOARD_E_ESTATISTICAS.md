# Painel e estatísticas

- **Barra móvel:** 52 px de altura, três opções visíveis por vez e rolagem lateral sem sobra após a última aba.
- **Dashboard:** resultado de janeiro a dezembro do ano selecionado, entradas e saídas, gastos por categoria, saldo diário e vencimentos.
- **Estatísticas:** 13 gráficos, comparação com o mês anterior e tabelas com os valores exatos.
- **Movimentos:** ao selecionar **Entrada**, o formulário mostra origem, valor, descrição, data e situação. Campos exclusivos de saída ficam ocultos.
- **Leitura:** resultado mensal = entradas realizadas − saídas realizadas. Meses sem registros aparecem sem valor; investimento registrado é saída de caixa, não cotação da carteira.

O mês selecionado define o ano do gráfico anual. Os demais gráficos mensais seguem o período de seis ou doze meses. Os dados vêm dos registros do aplicativo.

Para verificar: `python -m unittest discover -s backend/tests -t .`, `node tests/frontend-regression.cjs`, `node tests/analytics-regression.cjs` e `python tests/browser_smoke.py --browser CAMINHO_DO_CHROME --width 390`.
