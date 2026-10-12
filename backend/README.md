# GPC · backend

Node + Express 5 + Prisma (PostgreSQL). Autenticación con Cognito, archivos en S3,
lectura de facturas con Gemini.

```bash
npm install          # corre también prisma generate
npm run dev          # nodemon
npm start
npm test             # permisos, admin de empresa y rutas (sin base ni AWS)
```

Variables: ver [.env.example](.env.example). Alta de usuarios y grupos: [ADMIN_SETUP.md](ADMIN_SETUP.md).

Estructura: `src/modules/<módulo>/{*.routes,*.service}.js`, middleware de permisos en
`src/middleware/`, constantes compartidas en `src/common/`.
