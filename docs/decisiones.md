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

## Fase 4 — Mapa estatal

| Decisión | Motivo |
|---|---|
| El mapa se pinta con MapLibre sin mapa base: un GeoJSON, una capa de relleno y una de bordes. | Es lo único en pantalla; sin teselas no hay llamadas a terceros. El color por entidad es una expresión `match`, así que cambiar de indicador no recarga geometría. |
| El worker de MapLibre se declara con `setWorkerUrl(new URL(…, import.meta.url))`. | MapLibre busca su worker junto a su propio archivo, pero el empaquetador le cambia el nombre y la petición daba 404: el mapa quedaba en blanco en desarrollo y en producción. |
| El estado vive en la URL con `history.replaceState` y se lee una sola vez al cargar. | Es un export estático, sin servidor. Leerlo después de hidratar evita que el HTML del build discrepe de la URL. No se guarda historial por cada cambio. |
| La clase incluye su umbral superior y los umbrales repetidos se fusionan. | En sectores donde casi todas las entidades valen 0 %, los cuantiles coinciden. Con la regla anterior el 0 % caía en la clase más oscura, que decía lo contrario de los datos. Ahora hay menos clases, no clases vacías. |
| Paleta bivariada oscura: la clara con la claridad invertida (OKLab) en el rango 0.50-0.92. | Los tonos oscuros de la clara desaparecían contra el fondo oscuro. Peor pareja: ΔE 9.0 con daltonismo simulado y 10.4 con visión normal (la clara: 12.0 y 12.6); las nueve celdas superan 3:1 de contraste con el fondo. Es algo más débil que la clara, y la leyenda y la ficha no dependen solo del color. |
| La leyenda y la ficha solo citan las fuentes del año en pantalla. | El catálogo marca con `years` el censo de cada año (2023 y 2018); mostrar el de 2019 junto a una cifra de 2023 sería una cita equivocada. |
| La IED por habitante lleva su advertencia en el campo `warning` del catálogo, no solo en las limitaciones. | La especificación pide que se vea siempre con la cifra; así la ficha la muestra aparte y la cifra de la Ciudad de México sigue saliendo de los datos del mismo build. |
| En móvil el selector, el mapa, la leyenda y la ficha se apilan; la ficha no es una hoja inferior desplegable. | Una hoja que se arrastra es una interacción más que construir y probar. La pila cabe en 390 px y deja ver el mapa; la hoja queda como mejora si hace falta. |
| El formato de `missing` es `{motivo: [posiciones]}`, no `{posición: motivo}`. | Es como lo escribe el pipeline desde la fase 3: más corto cuando muchos territorios comparten motivo. La especificación se corrigió. |
| Playwright usa el Chrome instalado (`channel: "chrome"`) y sus pruebas viven en `web/e2e/`. | Evita descargar un navegador. Vitest solo corre `lib/`. |
| Shadcn/ui con la base Radix y el estilo `nova`, con los tokens de la especificación encima. | El estilo da la estructura de los componentes; colores, radio de 2 px y tipografía son los aprobados. Archivo se instala con `@fontsource-variable/archivo` en vez de `next/font/google`, para que el build no dependa de Google. |

## Fase 5 — Nivel municipal

| Decisión | Motivo |
|---|---|
| Los valores municipales por sector van en un archivo por sector con todos los municipios (`values/municipalities-sectors/{sector}.json`), no en uno por entidad. | El mapa clasifica sobre todo el nivel visible para que los colores no cambien al moverse. Con archivos por entidad, elegir un sector habría exigido descargar los 32. Cada sector pesa como mucho 63 KB comprimido. |
| El nivel lo decide el zoom: a partir de media unidad más cerca que el país entero se pintan municipios, si el indicador los tiene. Hacer clic en una entidad, buscar un lugar o abrir un enlace con `t` entra en su entidad. | Es el paso «al hacer clic o zoom» del planteamiento sin un control más. Con una unidad de zoom, las entidades grandes (Chihuahua, Jalisco) no cabían enteras al entrar. |
| Las capas 1 y 2 no vuelan al hacer clic y siguen pintando entidades al acercarse; la leyenda dice «Este indicador solo se publica por entidad». | Acercarse no mostraría nada nuevo. Si hay un municipio seleccionado, la ficha da el valor de su entidad con el aviso «No se publica por municipio». |
| Los colores municipales se clasifican sobre los 2,478 municipios, no sobre los de la entidad visible. | La especificación pide que los colores no cambien al moverse por el mapa. |
| Un corte de clase igual al valor máximo se descarta. | En el empleo en establecimientos de hasta 10 personas cientos de municipios valen 100 %; el último cuantil coincidía con el máximo y dejaba una clase vacía «por encima de 100 %». |
| La búsqueda filtra en el código propio (`lib/search.ts`) y muestra como mucho 30 resultados, entidades primero, con el nombre de la entidad junto a cada municipio. | cmdk habría renderizado 2,510 opciones. Varios municipios se llaman igual («Juárez» existe en cinco entidades). |
| La tabla alternativa municipal lista los municipios de la entidad seleccionada, o los 2,478 con su entidad si no hay selección. | Es la misma información que el mapa, en un tamaño legible. |
| Los límites estatales se dibujan más gruesos y en gris sobre los municipios. | Con el mismo trazo que los municipales no se distinguían. |

## Fase 6 — Comparar, contraargumento y metodología

| Decisión | Motivo |
|---|---|
| Comparar muestra cada indicador en su año más reciente y para todos los sectores, con una columna nacional. Un indicador que no existe por municipio muestra el valor de la entidad con su nombre debajo. | Así cada columna lee la misma serie y la comparación no depende del sector elegido en el mapa. |
| La vista de comparación cubre el mapa en lugar de desmontarlo. | Al volver a Explorar el mapa conserva su encuadre y su nivel. |
| En móvil la tabla de comparación se desplaza en horizontal con la columna de indicadores fija. | Cuatro columnas de cifras no caben en 390 px; con la columna fija cada valor conserva su nombre. |
| Los títulos y la presentación del contraargumento viven en el catálogo, con cada pareja nombrada (`foreign`, `domestic`). | Son textos que describen datos; el catálogo es su única fuente. |
| El panel del contraargumento no resume la tesis: da para cada pareja en cuántas entidades la cifra con capital extranjero es mayor y en cuántas menor, calculado en el navegador sobre los datos del mapa. | Los datos apuntan en direcciones distintas: la remuneración media es mayor con capital extranjero en 27 de 32 entidades, y la parte del valor agregado pagada en remuneraciones es menor en 20 de 32. Un texto fijo podría quedar desmentido por el siguiente build. |
| El botón «El contraargumento» es el único botón primario del mapa, abajo a la derecha; «Ver todo el país» pasó arriba a la derecha. | La especificación lo pide fijo y visible en el borde inferior. |
| Se añade el parámetro `panel=contraargumento` a la URL. | El planteamiento pide que todo el estado relevante se pueda compartir con un enlace; la especificación no tenía dónde guardarlo. |
| La metodología es una página estática que importa `catalog.json` en el build. Cada indicador se describe una vez, bajo la primera capa que lo usa; las demás capas lo enlazan. | Sin peticiones al cargar y sin texto duplicado. Dos indicadores se usan en dos capas, y describirlos dos veces habría repetido sus anclas. |
| El catálogo no lleva `generated_at`; se quitó del tipo y del ejemplo de la especificación. | El pipeline nunca lo escribió y la página lo habría mostrado vacío. Cada fuente ya lleva su fecha de descarga. |
| La navegación son enlaces con `aria-current`; en móvil va en un menú. | Explorar, Comparar y Metodología son secciones, no opciones de un control. En 390 px no caben junto al título y la búsqueda. |

## Fase 7 — Asistente

| Decisión | Motivo |
|---|---|
| Modelo por defecto: Claude Haiku 5.5 (`anthropic/claude-haiku-5.5`, 0.10/0.50 USD por millón de tokens). Lista corta: Haiku, DeepSeek V4 Flash, Gemini 3.1 Flash Lite y Qwen 3.7 Flash. Elegidos el 2026-11-17 de la lista de OpenRouter entre los modelos baratos con *tool calling*. | Fue el más preciso en la evaluación: 11/12 y 12/12 en dos rondas, y su único fallo fue un falso positivo de la comprobación. DeepSeek (12/12 y 11/12) es más barato y queda como alternativa; Qwen falló dos veces (una respuesta vacía); Gemini sacó 12/12 cuando la cuenta tuvo saldo. |
| GPT-6 Luna queda fuera de la lista. | OpenRouter limitó sus peticiones (429) incluso de una en una. Un visitante se encontraría el mismo error. |
| Cada petición lleva `max_tokens: 1200`. | Sin límite, OpenRouter reserva saldo para el máximo del modelo (65,536 tokens en algunos) y rechaza las claves con un tope de gasto. Las respuestas son de pocas frases. |
| Los esquemas de las herramientas enumeran los identificadores del catálogo (indicadores y sectores). | El modelo no puede pedir un indicador que no existe; si lo intenta, la herramienta responde con un error que lista los válidos. |
| Un indicador que solo existe por entidad, preguntado para un municipio, devuelve el valor de la entidad con una nota que lo dice. | Es la misma regla que la ficha. El modelo tiene instrucciones de explicar la nota. |
| Las herramientas que tocan municipios cargan antes sus archivos con la misma función que usa el mapa. | Los datos municipales se cargan bajo demanda; sin esto, una pregunta sobre un municipio fallaría si el lector no se había acercado al mapa. |
| El mensaje de sistema incluye lo que el lector tiene en pantalla (capa, indicador, sector, año y territorio). | Permite responder «¿y en este estado?» sin adivinar. |
| Las respuestas son texto plano: el modelo tiene instrucciones de no usar Markdown y la interfaz no lo interpreta. | Evita una dependencia para renderizar Markdown y el riesgo de mostrar HTML que venga del modelo. |
| El chat usa las primitivas de chat de shadcn (`message`, `bubble`, `message-scroller`, `trace`). Añaden la dependencia `@shadcn/react`. | Son los componentes de chat del sistema de componentes que ya usa el proyecto; el desplazamiento del historial en *streaming* no se resuelve en veinte líneas. |
| La evaluación (`pnpm eval:bot`) es una configuración aparte de Vitest que llama a OpenRouter con la clave de `.env`. Además de comprobar cada caso, exige que toda cifra con decimales o separador de miles de la respuesta aparezca en algún resultado de herramienta del mismo turno. | Las cifras esperadas se calculan con las propias herramientas, así que los casos siguen a los datos al reconstruirlos. La clave nunca llega al código ni al build: la app solo usa la que escribe cada visitante. |
| En móvil el asistente ocupa la pantalla bajo la barra; abrirlo vuelve a Explorar y cierra el contraargumento. | En 390 px el mapa, los controles y la leyenda no dejaban sitio para la conversación. Nunca hay dos paneles a la vez. |
| **Solo modelos gratuitos** (sustituye a la elección de Claude Haiku, a petición del autor). Lista: Nemotron 3.5 Super (`nvidia/nemotron-3.5-super-vl:free`, por defecto), Nemotron 3.5 Lightning y Ling 3.2 Flash. | De los 15 modelos gratuitos con *tool calling* del 2026-11-17, Nemotron 3.5 Super acertó las 12 preguntas de la evaluación sin cifras inventadas. Lightning y Ling resolvieron bien el caso del territorio ambiguo; no se evaluaron completos porque el nivel gratuito permite 50 peticiones diarias. Descartados: Nemotron 3 Ultra (el proveedor devolvió 503), Gemma 4 31B (saturado, 429), Inkling 2 Small (no disponible en la región) y los modelos de menos de 2,000 millones de parámetros o solo de código. |
| Los mensajes de error distinguen saturación o cupo agotado (429), proveedor caído (5xx), región (403) y política de datos (404), y sugieren cambiar de modelo. | Con modelos gratuitos estos fallos son frecuentes y su arreglo es casi siempre elegir otro de la lista. |
| El diálogo de la clave avisa del cupo diario y de que los proveedores gratuitos pueden guardar las preguntas. | Es lo que el visitante necesita saber antes de usarlos. |
| Las comprobaciones de cifras de la evaluación aceptan el número sin su unidad («24.6 por ciento» por «24.6 %»). | La cifra es la que importa; la regla anterior marcaba como error una respuesta correcta. |

