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

## Fase 3 — Pipeline

| Decisión | Motivo |
|---|---|
| Las fuentes se fijan por SHA-256 en `pipeline/sources.lock.json`, que sí se versiona. | Si el INEGI publica una versión corregida de un archivo, el build se detiene en vez de cambiar una cifra sin que nadie lo note. |
| El CI de cada push no ejecuta `pipeline build`; lo hace un flujo manual (`rebuild.yml`). | El build descarga unos 500 MB. Las pruebas de cada push comprueban los artefactos ya versionados. |
| Los estados se obtienen fusionando los municipios, no del archivo de entidades. | Así los dos niveles comparten exactamente los mismos bordes, y la simplificación conjunta no deja huecos. Entidades: 40 KB comprimidos; municipios: 855 KB. |
| Las geometrías municipales van en un solo GeoJSON, sin PMTiles. | Pesan 855 KB comprimidos, por debajo del límite de 1.5 MB que fijó la especificación. |
| Un estrato de tamaño sin fila es un cero solo si los estratos publicados suman el total; si no, es «confidencial». | El INEGI agrupa estratos por confidencialidad bajo la clave 99, y a veces los omite sin avisar. Tratar toda ausencia como cero habría inventado datos. |
| Tamaulipas 2018 queda «no publicado» en los indicadores por tamaño. | El archivo de 2019 recalculado no trae estratos para ese estado. |
| Un sector cuyo valor agregado produce una participación fuera de 0-1 queda «no calculable». | El valor agregado puede ser negativo. Un porcentaje negativo o mayor que 100 % no es una participación de nada. Afecta a 2 casos en 2023. |
| La informalidad y la pobreza laboral se promedian solo si los cuatro trimestres están publicados. | Promediar tres trimestres presentaría un año parcial como completo. Afecta a Guerrero, que queda sin dato de pobreza laboral en 2023. |
| El valor agregado por persona ocupada puede ser negativo en municipios pequeños. | Es el resultado literal del censo. No se oculta ni se corrige; la ficha lo mostrará con la nota del indicador. |
| `value_added_per_worker` y `wage_per_paid_worker` de 2018 están en pesos corrientes. | Se declara en las limitaciones; no se deflactan para no introducir un índice de precios que no está en las fuentes verificadas. |

## Fase 2 — Especificación

| Decisión | Motivo |
|---|---|
| Paleta bivariada propia (añil y ocre) en lugar de una de uso común. | Las cuatro bivariadas habituales que se midieron separan mal con daltonismo simulado (distancia mínima entre 2.2 y 6.5); la propia llega a 12.0. |
| Tipografía Archivo. | Una sola familia sans-serif con cifras tabulares y cobertura completa del español, comprobado en el archivo de la fuente. |
| Se añade al bot la herramienta `find_territory`. | El modelo no puede conocer las claves de 2,478 municipios, y varios comparten nombre. |
| "Personal sin sueldo en establecimientos micro" sustituye a "informalidad en las unidades micro" en el contraargumento. | La informalidad por tamaño de unidad no está en las fuentes verificadas. No se presenta como informalidad. |
| Los valores municipales se parten en un archivo con el total de sectores y 32 archivos por sector. | El total basta para pintar el mapa y hacer rankings nacionales; el desglose por sector solo se descarga cuando se pide. |
