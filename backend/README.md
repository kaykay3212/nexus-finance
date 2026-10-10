# Backend do Nexus Finance

O serviço Python serve a interface e a API pela mesma origem. No Render, configure `DATABASE_URL` como variável secreta com a URI PostgreSQL do Neon; não grave a URI no repositório. O start aplica as migrações e só inicia a API se o PostgreSQL estiver acessível:

```text
python -m backend.migrate && python -m backend.server
```

As migrações numeradas são aditivas e registradas em `schema_migrations`. Não edite migrações já aplicadas: crie uma nova versão. A migração `004_legacy_imports.sql` registra chaves de idempotência para a importação dos dados antigos do navegador.

Após entrar na conta, o painel de configurações oferece a importação dos registros locais. O usuário confirma antes do envio; transações e metas são validadas e gravadas em uma única transação PostgreSQL. A interface só remove os dados locais após confirmação do banco, e uma repetição da mesma solicitação não cria duplicatas.

Execute os testes e a verificação de sintaxe na raiz do projeto:

```powershell
python -m unittest discover -s backend\tests -t .
python -m py_compile backend\server.py backend\migrate.py
```

O health check `/api/health` verifica a disponibilidade HTTP. A inicialização executa as migrações antes de abrir o servidor, portanto uma falha de conexão com o banco impede que o serviço inicie normalmente.

## Sessão e primeiro acesso

O login entrega um cookie `HttpOnly`, `Secure` e `SameSite=Strict`; o banco armazena somente o hash do token. `SESSION_TTL_DAYS` controla a duração máxima da sessão no servidor (padrão de produção: 30 dias, máximo: 365). Por privacidade, ao abrir ou recarregar o site/PWA, o frontend revoga a sessão anterior deste navegador e mostra a tela de login; os dados só são carregados depois de autenticar novamente. Em **Configurações → Sair de todos os dispositivos**, também é possível revogar todas as sessões existentes da conta.

O cadastro público fica desativado por padrão (`ALLOW_PUBLIC_REGISTRATION=false`). Para provisionar uma conta nova, um responsável precisa habilitar temporariamente essa variável e definir `REGISTRATION_ALLOWED_EMAIL` com o endereço autorizado; outros e-mails continuam bloqueados. Desative o cadastro após o provisionamento. O projeto não tem recuperação de senha por e-mail configurada; não habilite um fluxo de recuperação sem um canal verificado.

## Aplicativo instalável

`manifest.json`, os ícones em `icons/`, `service-worker.js` e `offline.html` compõem o PWA. O worker mantém em cache apenas os arquivos públicos da interface; ignora `/api/`, não armazena respostas autenticadas e não enfileira gravações financeiras offline. Sem internet, login, sincronização e operações financeiras ficam indisponíveis. Quando há nova versão, a interface oferece atualização explícita em vez de recarregar durante uma operação.

No iPhone, abra o endereço HTTPS no Safari, escolha **Compartilhar → Adicionar à Tela de Início** e abra o ícone instalado. Faça login uma vez; próximas aberturas consultam a sessão segura e retornam ao dashboard enquanto ela estiver válida. O teste final de instalação, persistência de cookies e abertura após reiniciar precisa ser feito em um iPhone real.

## Visão de investimentos

A aba **Investimentos** agrega saídas marcadas com a classificação `Investimento`, categorias `Investimentos`/`Reserva` ou modo `Renda Fixa`. O painel resume os lançamentos guardados no backend, o histórico mensal e os valores previstos; não estima cotação nem confunde aportes registrados com o saldo de mercado da carteira.
