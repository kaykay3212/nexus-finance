# Nexus Finance — integração Binance (etapa 1)

## Objetivo
Mostrar os saldos da carteira **Spot** de uma conta Binance elegível, usando somente leitura. Nenhuma operação financeira, compra, venda, transferência ou saque é permitida pelo Nexus.

## Arquitetura
- `site-structure.js`: define a aba Binance (desktop).
- `index.html`: tela de saldos e atalho na seção Cripto & Mercado (inclusive no celular).
- `app.js`: solicita dados da API interna; não recebe nem armazena chaves.
- `backend/binance_client.py`: cliente Binance Spot REST assinado com HMAC SHA-256, somente GET /api/v3/account.
- `backend/server.py`: endpoints autenticados e restritos ao e-mail autorizado.
- `styles.css`: layout responsivo.

## Configuração privada (Render)
Defina as variáveis de ambiente no serviço, **nunca no GitHub, no chat ou no frontend**:
- `BINANCE_API_KEY`: chave de API de leitura.
- `BINANCE_API_SECRET`: segredo correspondente.
- `BINANCE_ALLOWED_USER_EMAIL`: e-mail da conta Nexus autorizada a visualizar essa carteira.

**Não ative permissões de trade, transferências ou saques.** Se a conta exigir lista de IPs permitidos, verifique a configuração de rede/saída do serviço Render. A API e os termos da Binance podem variar por região e elegibilidade. Não crie ou use uma conta que viole requisitos de idade ou outros termos.

## Endpoints
- `GET /api/binance/status`: informa se as três variáveis estão configuradas, somente para o usuário Nexus autorizado.
- `GET /api/binance/balances`: retorna apenas ativos com saldo Spot positivo, com quantidade livre e bloqueada. Não retorna chaves.
- Ambos exigem sessão Nexus válida. Sem `BINANCE_ALLOWED_USER_EMAIL`, acesso negado.

## Limites desta etapa
- Sem histórico de compras/vendas.
- Sem cotação em reais, patrimônio total ou sincronização com movimentações.
- Sem persistência de saldos ou chaves no banco.
- Sem configuração de chave pela interface.
- Sem testes com conta real: depende de credenciais e permissões válidas.
- A configuração por variáveis de ambiente representa uma única conta Binance por instância Nexus; não serve para múltiplos usuários. Para multiusuário, implementar cofre de credenciais por usuário antes de habilitar.
- O status e os saldos só são buscados ao abrir a aba e ao clicar em Atualizar.

## Próximas etapas
1. Validar API de leitura com conta elegível e chave restrita.
2. Criar tratamento de limites, timestamp e erros da Binance.
3. Implementar preços/valorização em BRL com cache e sem expor credenciais.
4. Histórico paginado de ordens/depositos, com deduplicação e consentimento.
5. Testes automatizados do backend, autorização e UI mobile.
