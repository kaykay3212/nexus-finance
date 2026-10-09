# Arquitetura do Nexus Finance

## Fonte canônica

| Área | Local |
| --- | --- |
| HTML | `frontend/index.html` |
| CSS | `frontend/css/styles.css` |
| JavaScript principal | `frontend/js/app.js` |
| Estrutura/configuração de páginas | `frontend/js/site-structure.js` |
| PWA | `frontend/manifest.json` |
| API e autenticação | `backend/server.py` |
| Banco/migrations | `backend/migrations/` |
| Dependências Python | `backend/requirements.txt` |
| Deploy | `render.yaml` |
| CI | `.github/workflows/security-ci.yml` |

## Fluxo

```text
Navegador
   ↓
frontend/
   ↓ /api/*
backend/server.py
   ↓
PostgreSQL
```

## Regras para mudanças futuras

1. Não criar cópias de frontend na raiz.
2. Não usar ZIP como fonte de deploy.
3. Alterações de banco entram como uma nova migration numerada; migrations antigas não são reescritas.
4. Segurança/autenticação pertencem ao backend, não ao JavaScript do navegador.
5. Antes de deploy, executar `python scripts/check_project.py`.
6. Mudanças grandes devem entrar por branch/PR para permitir revisão e rollback.

## Legado

Scripts do processo antigo de ZIP foram preservados em `archive/legacy-deploy/` apenas para histórico. Eles não participam do runtime.
