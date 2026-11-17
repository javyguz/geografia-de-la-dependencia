# Registro de decisiones

Decisiones de detalle tomadas durante el desarrollo, con su motivo. Las decisiones de fondo están en [brief.md](brief.md).

## Fase 0 — Base

| Decisión | Motivo |
|---|---|
| Python 3.14, no 3.15. | La 3.15 salió hace pocas semanas; las librerías geoespaciales que usará el pipeline suelen tardar en publicar binarios para una versión nueva. |
| TypeScript 5.x, la versión que instala `create-next-app`, no la 7.0. | Se mantiene la versión con la que Next.js 16.4 genera sus proyectos hasta comprobar que la 7.0 es compatible. |
| Los comandos se ejecutan dentro de `pipeline/` y de `web/`; no hay un espacio de trabajo en la raíz. | Son dos proyectos independientes con herramientas distintas. Un envoltorio común sería una capa más que leer. |
| Se quitaron `cacheComponents` y `partialPrefetching` de la plantilla de Next.js. | Son funciones de renderizado en servidor y el sitio es un export estático. |
| Sin tipografía propia por ahora; se usa la del sistema. | La familia tipográfica forma parte de la dirección visual, que se define en la fase 2. |
| shadcn/ui se inicializará después de aprobar los tokens (fase 2). | Su instalación fija colores, radios y librería base; hacerlo antes sería decidir el diseño por omisión. |
| Playwright se añadirá en la fase 4. | Todavía no existe ningún flujo que probar. |
| Las pruebas de Python se lanzan con `uv run python -m pytest`. | El Control inteligente de aplicaciones de Windows bloquea el ejecutable `pytest.exe` por no estar firmado; invocarlo como módulo funciona en cualquier sistema. |
| Las skills de terceros para agentes (`.agents/`, `.claude/skills/`) no se versionan; sí `skills-lock.json`. | Son código ajeno que añadiría ruido al repositorio. Se restauran con `npx skills experimental_install`. |

## Fase 1 — Fuentes

| Decisión | Motivo |
|---|---|
| El pipeline descarga archivos directos del INEGI, sin sus API ni token. | Todas las fuentes verificadas se publican como archivos. Un token sería un requisito más para reproducir las cifras. |
| El DENUE no se usa en la v1. | Los Censos Económicos ya dan unidades y empleo por tamaño a nivel municipal; el DENUE solo añadiría rangos más finos. |
| El capital extranjero se muestra solo para 2023. | El censo de 2019 definía "unidad grande" con otros umbrales, así que las dos cifras no son comparables. |

## Fase 2 — Especificación

| Decisión | Motivo |
|---|---|
| Paleta bivariada propia (añil y ocre) en lugar de una de uso común. | Las cuatro bivariadas habituales que se midieron separan mal con daltonismo simulado (distancia mínima entre 2.2 y 6.5); la propia llega a 12.0. |
| Tipografía Archivo. | Una sola familia sans-serif con cifras tabulares y cobertura completa del español, comprobado en el archivo de la fuente. |
| Se añade al bot la herramienta `find_territory`. | El modelo no puede conocer las claves de 2,478 municipios, y varios comparten nombre. |
| "Personal sin sueldo en establecimientos micro" sustituye a "informalidad en las unidades micro" en el contraargumento. | La informalidad por tamaño de unidad no está en las fuentes verificadas. No se presenta como informalidad. |
| Los valores municipales se parten en un archivo con el total de sectores y 32 archivos por sector. | El total basta para pintar el mapa y hacer rankings nacionales; el desglose por sector solo se descarga cuando se pide. |
