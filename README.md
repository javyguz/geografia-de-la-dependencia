# Geografía de la dependencia

Mapa interactivo de México, a nivel estatal y municipal, que muestra con datos públicos cómo se distribuye en el territorio el peso del capital extranjero, quién se queda con el valor que se produce y si la integración exportadora mejora o no las condiciones de trabajo locales.

> **Estado:** en construcción. Por ahora el repositorio contiene solo la base del proyecto; todavía no hay datos ni mapa.

## Principios

1. **Limpieza visual.** La pantalla muestra el mapa, una leyenda y una ficha.
2. **Limpieza del código.** Cualquiera debe poder leer el repositorio en una tarde y reproducir cada cifra.
3. **Honestidad con los datos.** Cada número lleva unidad, año y fuente. Lo que no existe se muestra como "sin dato", nunca como cero ni como estimación. La app enseña también la evidencia que contradice la tesis que acompaña.

## Estructura

| Directorio | Contenido |
|---|---|
| `pipeline/` | Python. Descarga las fuentes públicas, calcula los indicadores y genera los archivos que lee la web. |
| `web/` | Next.js. Sitio estático que lee esos archivos; no hay servidor ni base de datos. |
| `docs/` | Planteamiento del proyecto, fuentes y registro de decisiones. |

## Ejecutarlo en local

Requisitos: [uv](https://docs.astral.sh/uv/), [Node.js](https://nodejs.org/) 24 y [pnpm](https://pnpm.io/).

**Web**

```
cd web
pnpm install
pnpm dev
```

**Pipeline de datos**

```
cd pipeline
uv run pipeline build
```

## Comprobaciones

Las mismas que ejecuta la integración continua en cada push.

| | Pipeline (`pipeline/`) | Web (`web/`) |
|---|---|---|
| Formato y lint | `uv run ruff format --check` y `uv run ruff check` | `pnpm lint` |
| Tipos | `uv run pyright` | `pnpm typecheck` |
| Pruebas | `uv run python -m pytest` | `pnpm test` |
| Build | `uv run pipeline build` | `pnpm build` |

## Fuentes y licencias

El código se publica bajo licencia [MIT](LICENSE). Las fuentes de datos y sus términos de uso se documentarán en `docs/fuentes.md`.

## Contribuir

Abre un issue antes de proponer un cambio grande. Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/) y se escriben en inglés, igual que el código; la interfaz y la documentación van en español.
