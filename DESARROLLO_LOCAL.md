# Ver los cambios en local

Hay dos formas, de menos a más parecida a producción. Ninguna toca producción.

## 1. Modo demo (sin backend, sin .env)

Sólo el frontend, con datos de ejemplo en memoria. Sirve para ver pantallas,
textos, modo oscuro, celular y permisos.

```bash
cd frontend
npm install
npm run demo        # http://localhost:5173
```

- Abajo a la derecha aparece el cartel **Modo demo**: ahí elegís con qué rol
  entrar (administrador general, administrador de empresa, usuario que carga,
  sólo lectura) y podés **reiniciar los datos**.
- Lo que cambiás (subir un archivo, marcar un ítem, editar comprobantes) se
  guarda en el navegador hasta que reiniciás.
- El checklist sale del archivo real del backend
  (`backend/src/common/constants/checklist-items.js`), no de una copia.
- No hay archivos reales: bajar PDFs, el Excel COMAP o la planilla del
  simulador muestra un aviso.
- El código del demo vive en `frontend/src/demo/` y sólo se carga con
  `--mode demo`: el build normal no lo incluye.

## 2. Local completo (backend + frontend en tu máquina)

Usa el backend de verdad, así que necesita `.env`. **Antes de arrancar, revisá
que `DATABASE_URL` no sea la base de producción.** Lo más seguro es una base
local en Docker:

```bash
cd backend
docker compose -f docker-compose.local.yml up -d
```

`backend/.env` (copiá `.env.example`):

```
PORT=3001
DATABASE_URL=postgresql://gpc:gpc@localhost:5433/gpc_local
DIRECT_URL=postgresql://gpc:gpc@localhost:5433/gpc_local
GEMINI_API_KEY=...           # para leer facturas con IA
S3_BUCKET=...                # idealmente un bucket de prueba, no el de producción
COGNITO_USER_POOL_ID=...     # el mismo que usa el frontend
COGNITO_CLIENT_ID=...
```

Crear las tablas en la base local (sólo la local):

```bash
npx prisma migrate deploy
npm run dev                  # http://localhost:3001
```

`frontend/.env.local`:

```
VITE_COGNITO_USER_POOL_ID=...
VITE_COGNITO_CLIENT_ID=...
```

```bash
cd frontend
npm run dev                  # http://localhost:5173, /api va al backend en 3001
```

La base local arranca vacía: para entrar como administrador general tu
usuario de Cognito tiene que estar en el grupo `admins` (ver
`backend/ADMIN_SETUP.md`), y las empresas se crean desde la pantalla.
