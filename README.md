# Nexus Finance

Aplicação web de finanças pessoais com frontend próprio, API Python e PostgreSQL.

## Estrutura

```text
frontend/
  index.html
  manifest.json
  css/styles.css
  js/app.js
  js/site-structure.js

backend/
  server.py
  migrate.py
  requirements.txt
  migrations/

integrations/
  google-apps-script/

scripts/
  check_project.py

docs/
  ARCHITECTURE.md

archive/
  legacy-deploy/
```

## Regra de organização

- **Frontend:** tudo visual e comportamento do navegador fica em `frontend/`.
- **Backend:** API, autenticação, segurança, banco e migrations ficam em `backend/`.
- **Integrações:** código externo fica em `integrations/`.
- **Scripts:** ferramentas de manutenção ficam em `scripts/`.
- **Produção:** Render instala `backend/requirements.txt` e inicia `backend.server`.
- O ZIP antigo de deploy não é mais fonte de produção.

Antes de publicar, rode:

```bash
python scripts/check_project.py
```

Veja `docs/ARCHITECTURE.md` para o mapa de manutenção.
