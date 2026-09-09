# Cuestionario final · ciess-riuss-congreso.pages.dev

Sitio del cuestionario final del módulo de bases de datos para programas sociales,
con panel del instructor. Corre sobre **Cloudflare Pages** (archivos estáticos),
**Pages Functions** (API) y **D1** (base de datos SQLite).

```
site/
├── public/            Interfaz: cuestionario y panel
│   ├── index.html
│   └── assets/        estilos.css · app.js
├── functions/api/     API sobre Pages Functions
│   ├── cuestionario.js    GET    preguntas (sin la clave de respuestas)
│   ├── verificar.js       GET    ¿este participante ya usó su intento?
│   ├── entregas.js        POST   califica en el servidor y registra la entrega
│   ├── sesion.js          GET/POST/DELETE  sesión del panel
│   └── panel/
│       ├── entregas.js    GET    entregas, resumen y acierto por reactivo
│       └── csv.js         GET    exportación en CSV
├── lib/               Banco de reactivos, calificación y firma de sesión
├── schema.sql         Tabla `entregas` e índice de intento único
└── wrangler.toml      Proyecto de Pages y enlace con D1
```

## Decisiones que sostienen el sitio

- **La clave de respuestas nunca llega al navegador.** `/api/cuestionario` entrega
  los reactivos sin el campo `correcta`; la calificación se calcula en
  `functions/api/entregas.js`.
- **Un intento por participante.** El índice único sobre `nombre_normalizado`
  (sin acentos, mayúsculas ni espacios de más) rechaza la segunda entrega con
  un `409`; `/api/verificar` avisa antes de que la persona conteste.
- **El panel se protege en el servidor.** La contraseña vive como secreto del
  proyecto, se compara en tiempo constante y la sesión viaja en una cookie
  `HttpOnly; Secure; SameSite=Strict` firmada con HMAC-SHA256.

## Puesta en marcha

### 1. Base de datos

```bash
cd site
npm install
npx wrangler d1 create ciess-riuss-congreso     # copie el database_id en wrangler.toml
npx wrangler d1 execute ciess-riuss-congreso --remote --file=schema.sql
```

### 2. Secretos del proyecto

| Secreto | Uso |
| --- | --- |
| `PANEL_USUARIO` | Usuario del panel (por omisión `Admin`) |
| `PANEL_PASSWORD` | Contraseña del panel |
| `SESSION_SECRET` | Cadena aleatoria para firmar la cookie de sesión |

```bash
npx wrangler pages secret put PANEL_PASSWORD --project-name=ciess-riuss-congreso
npx wrangler pages secret put SESSION_SECRET --project-name=ciess-riuss-congreso
```

### 3. Publicación

```bash
npx wrangler pages deploy --project-name=ciess-riuss-congreso --branch=main
```

El sitio queda en `https://ciess-riuss-congreso.pages.dev`.

### Despliegue desde GitHub

`.github/workflows/desplegar-pages.yml` hace lo anterior en cada push a `main`
o a mano desde la pestaña Actions. Requiere estos secretos del repositorio:
`CLOUDFLARE_API_TOKEN` (permisos *Cloudflare Pages: Edit* y *D1: Edit*),
`CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `PANEL_PASSWORD`, `SESSION_SECRET`
y, si se cambia, `PANEL_USUARIO`.

## Desarrollo local

```bash
cp .dev.vars.example .dev.vars          # credenciales locales, no se versiona
npx wrangler d1 execute ciess-riuss-congreso --local --file=schema.sql
npm run dev                             # http://127.0.0.1:8788
```

El panel está en `/#panel`.

## Operación

- **Reactivos y textos:** `lib/cuestionario.js` (enunciados, opciones, clave y
  explicaciones, más el tiempo, la ponderación y las fechas).
- **Calificación:** 10 puntos repartidos entre los reactivos; aprobatoria 7.0.
- **Descarga de resultados:** botón *Descargar CSV* del panel, o
  `npx wrangler d1 execute ciess-riuss-congreso --remote --command "SELECT * FROM entregas"`.
- **Reabrir un intento:**
  `npx wrangler d1 execute ciess-riuss-congreso --remote --command "DELETE FROM entregas WHERE nombre_normalizado = 'nombre sin acentos'"`.
