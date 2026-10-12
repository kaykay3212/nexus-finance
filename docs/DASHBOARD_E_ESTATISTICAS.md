# Dashboard, estatísticas e navegação mobile

## Barra inferior

A altura passou de 70 para 56 pixels. Os botões mantêm uma área de toque de 46 pixels e não aumentam de largura ao serem selecionados. A barra pode rolar horizontalmente em telas menores, mas não possui mais os espaços invisíveis nas extremidades. A rolagem automática só move o necessário para mostrar a opção escolhida.

## Dashboard: quatro gráficos principais

1. **Entradas e saídas:** compara o movimento de caixa realizado ao longo dos meses. Investimentos feitos aparecem como saídas, pois retiram dinheiro do caixa.
2. **Gastos por categoria:** mostra as cinco maiores categorias do mês. A tabela contém todas as categorias.
3. **Saldo acumulado no mês:** acompanha entradas menos saídas desde zero no primeiro dia. Não é o saldo bancário e não inclui patrimônio anterior.
4. **Vencimentos em aberto:** separa atrasados, vencendo hoje, nos próximos sete dias, de oito a trinta dias e depois de trinta dias. Considera os compromissos e assinaturas de todos os meses.

Os indicadores e o acompanhamento das metas continuam disponíveis.

## Estatísticas: doze análises

| Gráfico | Pergunta que ajuda a responder |
|---|---|
| Entradas e saídas | Quanto entrou e saiu em cada mês? |
| Resultado de cada mês | Em quais meses o caixa terminou positivo ou negativo? |
| Saldo acumulado no mês | Como o resultado se formou ao longo dos dias? |
| Gastos por categoria | Quais categorias concentram as saídas? |
| De onde veio a renda | Quais fontes compõem as entradas? |
| Classificação dos gastos | Como se distribuem essenciais, compromissos e outras classificações? |
| Categorias: este mês × anterior | Quais categorias aumentaram ou diminuíram? |
| Realizado e ainda em aberto | Quanto já foi pago e quanto está previsto, pendente ou atrasado? |
| Evolução dos aportes | Quanto foi destinado a investimentos em cada mês? |
| Quanto sobrou da renda | Qual parcela da renda ficou em caixa? |
| Metas: acumulado × objetivo | Qual é a distância entre o valor informado e o objetivo? |
| Vencimentos em aberto | Quando os compromissos ainda não pagos vencem? |

Há também três comparações resumidas com o mês anterior: entradas, saídas e saldo. O seletor de mês das estatísticas funciona também no celular e acompanha o mês do dashboard. O histórico permite escolher seis ou doze meses; a escolha afeta os gráficos mensais das duas páginas.

## Como interpretar

- Os valores vêm dos registros do site. Os gráficos não consultam saldo bancário nem estimam rentabilidade.
- Realizado/pago e pendente/previsto são tratados separadamente. Datas dos lançamentos definem os meses dos gráficos, como no restante do painel.
- No mês atual, a comparação avisa que ele ainda está em andamento. O mês anterior contém o total registrado do período inteiro.
- Sem renda, a taxa de saldo sobre renda fica sem valor, em vez de produzir divisão por zero.
- Sem registros no mês anterior ou selecionado, a comparação informa a falta de dados. Totais zero significam zero registrado, não comprovação de ausência de movimentação externa.
- A linha diária do mês atual termina no dia atual; dias futuros não são desenhados como histórico observado.
- Cada gráfico tem uma tabela expansível com os valores exatos. Textos e rótulos fornecidos pelo usuário são escapados antes de inserir no HTML.

## Implementação e validação

Os cálculos e os gráficos ficam em `finance-analytics.js`. Barras em HTML e linhas em SVG substituem a dependência externa de gráficos. O arquivo foi incluído na lista de arquivos públicos do servidor, no cache do PWA e nos workflows de teste e empacotamento. A versão dos recursos passou para `20261011-charts1`.

Foram adicionados testes de somas, saldo negativo, datas, comparação de categorias, metas, falta de renda e escape de rótulos. Os testes de navegador verificam quatro gráficos no dashboard, doze nas estatísticas, tabelas, mudança de período, sincronização do mês e ausência de transbordamento horizontal. No mobile, também medem a altura da barra e o espaço após o último botão.

As verificações usam dados fictícios. As mudanças são locais na pasta `nexus-finance-publish`; a publicação não foi executada.
