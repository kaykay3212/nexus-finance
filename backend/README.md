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

No iPhone, abra o endereço HTTPS no Safari, escolha **Compartilhar → Adicionar à Tela de Início** e abra o ícone instalado. Faça login a cada abertura ou recarga, conforme a política de privacidade descrita acima. A instalação e a abertura após reiniciar precisam ser verificadas em um iPhone real.

## Publicação e pagamentos

O serviço existente no Render ainda extrai `nexus-finance-deploy.zip` antes de instalar as dependências. Antes de publicar qualquer mudança, execute `python tools/build_deploy_package.py` na raiz do projeto e inclua o ZIP atualizado no mesmo commit. A CI compara o conteúdo do ZIP com os arquivos fonte. O `render.yaml` usa diretamente o checkout para novos serviços; ele não altera automaticamente o comando de build já configurado no painel do serviço existente. Frontend e backend devem ser publicados juntos.

Marcar um pagamento e gerar sua próxima parcela/recorrência acontecem na mesma transação do banco, com bloqueio do registro. Repetir a baixa de um registro pago não altera a data nem cria outra parcela. Parcelamentos finitos terminam na última parcela; assinaturas sem parcelamento seguem a recorrência escolhida. Vencimentos no fim do mês usam o último dia disponível e preservam o dia original para os meses seguintes. A data de pagamento usa o fuso America/Sao_Paulo.

Clientes antigos devem atualizar antes de marcar pagamentos: a API exige `atomicPayment: true` para impedir que uma versão antiga também crie a próxima parcela no navegador.

O saldo mensal considera todas as entradas e saídas realizadas, incluindo aportes. Aportes também aparecem no indicador de investimentos; esse indicador é uma separação das saídas, não uma segunda dedução do saldo. Pendências incluem compromissos e assinaturas ainda não realizados.

## Visão de investimentos

A aba **Investimentos** agrega saídas marcadas com a classificação `Investimento`, categorias `Investimentos`/`Reserva` ou modo `Renda Fixa`. O painel resume os lançamentos guardados no backend, o histórico mensal e os valores previstos; não estima cotação nem confunde aportes registrados com o saldo de mercado da carteira.
