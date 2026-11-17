# Geografía de la dependencia

Web app estática, pública y open source: un mapa interactivo de México (entidades y municipios) hecho con datos públicos. El planteamiento completo está en [docs/brief.md](docs/brief.md); léelo antes de empezar una fase. Las decisiones tomadas por el camino se anotan en [docs/decisiones.md](docs/decisiones.md).

## Valores que pesan más que cualquier funcionalidad

1. Limpieza visual: mapa, leyenda y una ficha. Nada más compite por la atención.
2. Limpieza del código: un tercero puede leer el repositorio en una tarde y reproducir cada cifra.
3. Honestidad con los datos: cada número lleva unidad, año y fuente. Lo que falta o está suprimido se conserva como nulo con su motivo ("sin dato"); nunca cero, imputado ni interpolado.

Si un cambio obliga a elegir entre añadir algo y mantener estos valores, mantén los valores y avisa.

## El catálogo es la única fuente de verdad

`web/public/data/catalog.json` (lo genera el pipeline) describe cada indicador. La leyenda, la ficha, la página de metodología y el diccionario de datos del bot se derivan de él. Si un dato se describe en dos sitios, sobra uno.

## Convenciones

- Interfaz y documentación en español. Código, identificadores y commits en inglés.
- Commits pequeños con formato Conventional Commits.
- La clave de unión geográfica es siempre `CVEGEO` (2 dígitos para entidad, 5 para municipio).
- Sin abstracciones anticipadas, código muerto ni dependencias que se resuelvan con veinte líneas. Justifica cada librería antes de añadirla.
- Los comentarios explican el porqué, no repiten el código.
- El equipo puede ser Windows: nada de scripts de bash. Usa `uv run` y scripts de `package.json`.
- Usa versiones estables actuales y consulta la documentación vigente (Context7, o `web/node_modules/next/dist/docs/` para Next.js) en vez de fiarte de la memoria.
- Los secretos (token del INEGI y similares) van en `.env`, documentados en `.env.example`. Nunca en el código ni en el historial.

## pipeline/ (Python, solo uv)

Se ejecuta desde `pipeline/`. Nunca pip, poetry ni conda.

| Tarea | Comando |
|---|---|
| Generar todos los artefactos | `uv run pipeline build` |
| Solo descargar las fuentes | `uv run pipeline fetch` (`--refresh` para fijar versiones nuevas) |
| Formato | `uv run ruff format` |
| Lint | `uv run ruff check` |
| Tipos | `uv run pyright` |
| Pruebas | `uv run python -m pytest` |
| Añadir una dependencia | `uv add <paquete>` |

- `fetch/` descarga los datos crudos (en caché, con checksum, fuera del repositorio). `transform/` contiene funciones pequeñas y puras. `build/` valida contra `schemas.py` y exporta.
- Tipado completo, pyright en modo estricto. Polars para tablas; GeoPandas solo donde haga falta geometría (`transform/geometry.py`, el único módulo con la comprobación de tipos relajada).
- Los textos de indicadores, fuentes y sectores viven en `pipeline/src/pipeline/catalog.toml`; `catalog.json` se genera desde ahí. No se edita `web/public/data/` a mano.
- Todo valor que falta lleva un motivo (`confidential`, `not_published`, `not_collected`, `not_computable`, `no_population`). Nunca se imputa.

## web/ (Next.js, pnpm)

Se ejecuta desde `web/`. Export estático (`output: "export"`): sin código de servidor, route handlers ni server actions.

| Tarea | Comando |
|---|---|
| Servidor de desarrollo | `pnpm dev` |
| Formato y lint (escribe) | `pnpm format` |
| Lint (comprueba) | `pnpm lint` |
| Tipos | `pnpm typecheck` |
| Pruebas de `lib/` | `pnpm test` |
| Pruebas en navegador | `pnpm test:e2e` (usa el Chrome instalado) |
| Evaluación del asistente | `pnpm eval:bot` (usa `OPENROUTER_API_KEY` de `.env` y el cupo diario de modelos gratuitos; `BOT_CASES` y `BOT_MODELS` acotan la ejecución) |
| Build | `pnpm build` |

- TypeScript estricto, sin `any`. Biome para formato y lint. Vitest para las funciones puras de `lib/`.
- Sin llamadas a terceros al cargar. Las tipografías se autoalojan.

## Flujo de trabajo

Se trabaja por las fases del planteamiento. Cada fase se cierra con un commit y un resumen breve; las fases 1 y 2 necesitan la aprobación explícita del usuario antes de continuar.
