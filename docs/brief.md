# Planteamiento del proyecto

Documento de partida, tal como se escribió antes de empezar a construir. Describe qué se quiere, las decisiones tomadas de antemano y el plan de trabajo.

## 1. Qué vamos a construir y para qué

Una web app pública y open source llamada **Geografía de la dependencia**: un mapa interactivo de México, a nivel estatal y municipal, que muestra con datos públicos cómo se distribuye en el territorio el peso del capital extranjero, quién se queda con el valor que se produce y si la integración exportadora mejora o no las condiciones de trabajo locales.

El proyecto acompaña una tesis sobre soberanía económica en México. Su público son personas que debaten estos temas (estudiantes, periodistas, académicos) y que necesitan un dato verificable en segundos. Por eso hay tres valores que pesan más que cualquier funcionalidad:

1. **Limpieza visual.** La pantalla muestra el mapa, una leyenda y una ficha. Nada más compite por la atención.
2. **Limpieza del código.** Un tercero debe poder leer el repositorio, entenderlo en una tarde y reproducir cada cifra.
3. **Honestidad con los datos.** Cada número lleva unidad, año y fuente. Lo que no existe se muestra como "sin dato", nunca como cero ni como estimación silenciosa. La app enseña también la evidencia que contradice la tesis; eso es lo que la vuelve creíble.

Si en algún momento una decisión te obliga a elegir entre añadir algo y mantener estos tres valores, mantén los valores y dímelo.

## 2. Decisiones ya tomadas

No vuelvas a preguntar por estas; si alguna resulta inviable, explícame por qué y propón la alternativa más simple.

| Tema | Decisión |
|---|---|
| Arquitectura | Estática. Un pipeline de datos en Python genera archivos listos; el frontend los lee. Sin base de datos y sin servidor propio en la v1. |
| Python | **uv** como gestor de paquetes y entornos (`uv init`, `uv add`, `uv run`). Nada de pip, poetry ni conda. |
| Frontend | Next.js (App Router) con TypeScript estricto, renderizado estático. Tailwind CSS y shadcn/ui. pnpm. |
| Mapa | MapLibre GL JS. Coropleta sobre fondo neutro, **sin mapa base de teselas** (menos ruido y ninguna dependencia de proveedores). |
| Gráficas | Las de shadcn/ui (Recharts). Solo gráficas pequeñas dentro de la ficha. |
| Granularidad | Estatal (32 entidades) y municipal (~2,470 municipios), con paso de una a otra al hacer clic o zoom. |
| Bot | Chat que responde únicamente sobre los datos del mapa. Cada visitante usa su propia API key de OpenRouter, guardada solo en su navegador. |
| Hosting | Vercel, con el directorio `web/` como raíz del proyecto. |
| Repositorio | GitHub, público, licencia MIT para el código. |
| Idioma | Interfaz y documentación en español. Código, identificadores y commits en inglés. |
| Fuentes | Cualquier fuente pública oficial, no solo INEGI. |

Usa siempre las versiones estables actuales de cada librería y consulta su documentación vigente (con Context7 si está instalado) en lugar de confiar en lo que recuerdes. Mi equipo puede ser Windows: no dependas de scripts de bash; usa `uv run` y scripts de `package.json`.

## 3. Las cuatro capas del mapa

Cada capa responde una pregunta. El nombre de la capa en la interfaz es la pregunta.

### Capa 1 — ¿Cuánto pesa el capital extranjero?

Participación de las unidades económicas con capital extranjero en personal ocupado, valor agregado censal bruto y remuneraciones, por territorio y sector.

- Fuente candidata: Censos Económicos 2024 del INEGI (resultados definitivos, datos de 2023), tabulados y SAIC. Censos 2019 para comparar en el tiempo.

### Capa 2 — ¿Derrama o enclave?

Mapa **bivariado** (paleta 3×3): intensidad de integración externa contra condiciones de trabajo.

- Eje de integración: participación del capital extranjero (Censos Económicos), exportaciones por entidad federativa (INEGI) e IED por entidad (Secretaría de Economía, Registro Nacional de Inversiones Extranjeras).
- Eje de condiciones: informalidad e ingreso laboral (ENOE), pobreza laboral, salario base de cotización por municipio (datos abiertos del IMSS), remuneración media por persona ocupada (Censos Económicos).
- Advertencia obligatoria en la interfaz: la IED por entidad se registra en buena medida por domicilio fiscal y la Ciudad de México concentra cerca de la mitad del total, así que no mide dónde opera la inversión.

### Capa 3 — ¿Quién se queda con el valor?

Remuneraciones entre valor agregado censal bruto, por territorio y sector. Complementos: valor agregado por persona ocupada frente a remuneración por persona ocupada.

- Fuente candidata: Censos Económicos.
- La nota metodológica debe decir con claridad que es un indicador aproximado del reparto entre trabajo y capital, y qué deja fuera.

### Capa 4 — Tejido empresarial y maquila

Densidad de unidades económicas por tamaño (micro, pequeña, mediana, grande), concentración del empleo en establecimientos grandes y peso del empleo en establecimientos IMMEX.

- Fuentes candidatas: DENUE (INEGI), Censos Económicos, estadística IMMEX (INEGI).

### Datos de apoyo

- Geometrías: Marco Geoestadístico del INEGI (entidades y municipios), simplificadas para web. La clave de unión es siempre `CVEGEO` (2 dígitos para entidad, 5 para municipio).
- Población para tasas per cápita: Censo de Población 2020 o proyecciones de CONAPO.

**Estas fuentes son candidatas, no hechos verificados.** Tu primera tarea (fase 1) es comprobar qué existe realmente, a qué nivel geográfico, para qué años y con qué restricciones de confidencialidad.

## 4. Funciones de la app

1. **Explorar** (vista por defecto). Mapa a pantalla completa, selector de capa, selector de indicador y sector, leyenda, búsqueda de entidad o municipio, y una ficha lateral del territorio seleccionado.
2. **Ficha del territorio.** Valor del indicador activo, posición en el ranking, comparación con la media nacional, una o dos gráficas pequeñas y la fuente con enlace.
3. **Comparar.** Dos o tres territorios lado a lado en todos los indicadores.
4. **El contraargumento.** Un panel fijo y visible, no escondido, con los datos que incomodan a la tesis: por ejemplo, remuneraciones medias más altas en unidades con capital extranjero, o informalidad en las unidades micro. Mismo rigor y mismo diseño que el resto.
5. **Recorrido** (modo narrativo). De cinco a seis pasos que llevan el mapa de una vista a otra con un párrafo corto cada uno. El texto vive en un archivo de contenido fácil de editar; déjalo con texto provisional marcado como tal, lo redactaré yo.
6. **Metodología.** Página generada a partir del catálogo de datos: definición, fórmula, fuente, año, cobertura y limitaciones de cada indicador.
7. **Bot.** Ver sección 6.

Todo el estado relevante (capa, indicador, territorio, comparación) vive en la URL, para que cualquier vista se pueda compartir con un enlace.

## 5. Arquitectura

```
/
├── pipeline/            # Python + uv
│   ├── src/pipeline/
│   │   ├── fetch/       # descarga cruda, en caché, con checksum; nunca se edita a mano
│   │   ├── transform/   # limpieza y cálculo de indicadores, funciones puras
│   │   ├── build/       # exporta artefactos y catalog.json
│   │   └── schemas.py   # esquemas validados de cada tabla
│   └── tests/
├── web/                 # Next.js
│   ├── app/
│   ├── components/
│   ├── lib/             # escalas, formato, acceso a datos, herramientas del bot
│   └── public/data/     # artefactos generados por el pipeline (sí se versionan)
├── docs/                # spec, fuentes, decisiones
├── CLAUDE.md
└── README.md
```

**El catálogo es la única fuente de verdad.** `catalog.json` describe cada indicador: id, nombre, pregunta que responde, definición, fórmula, unidad, fuente, URL, año, niveles geográficos disponibles, cobertura y notas. La leyenda, la ficha, la página de metodología y el diccionario de datos del bot se generan a partir de él. Si un dato se describe en dos sitios, sobra uno.

Reglas del pipeline:

- Reproducible de principio a fin con un solo comando (`uv run pipeline build`).
- Datos crudos fuera del repositorio (`.gitignore`); artefactos finales, pequeños, dentro.
- Los tokens de las API del INEGI y similares van en `.env`, con un `.env.example` documentado. Nunca en el código ni en el historial.
- Cada tabla se valida contra su esquema antes de exportarse: claves `CVEGEO` que casan con las geometrías, proporciones entre 0 y 1, 32 entidades, sin duplicados.
- Los valores suprimidos por confidencialidad se conservan como nulos con su motivo. No imputes ni interpoles.

Reglas del frontend:

- Carga inicial ligera: geometría y datos estatales primero; los municipales se cargan al acercarse o al entrar a una entidad. Si las geometrías municipales pesan demasiado como GeoJSON simplificado, usa PMTiles.
- Sin llamadas a servicios de terceros al cargar, salvo las tipografías autoalojadas.
- Analítica: solo Vercel Web Analytics, sin cookies ni rastreadores.

## 6. El bot

Propósito: responder preguntas sobre los datos del mapa, y solo sobre ellos. No opina, no interpreta la tesis y no usa conocimiento externo para dar cifras.

Diseño, deliberadamente simple:

- **Sin RAG vectorial y sin frameworks de agentes.** Los datos son tablas pequeñas y estructuradas; lo correcto es *tool calling* sobre ellas.
- El modelo recibe el diccionario de datos (derivado de `catalog.json`) y un conjunto corto de herramientas que se ejecutan en el navegador sobre los datos ya cargados. Por ejemplo: `get_value`, `rank`, `compare`, `describe_indicator` y `show_on_map` (que mueve el mapa al territorio e indicador mencionados).
- Toda cifra de una respuesta sale de una llamada a herramienta e incluye indicador, territorio, año y fuente. Si la pregunta no se puede responder con los datos, el bot lo dice y sugiere qué sí puede responder.
- Llamadas directas del navegador a la API de OpenRouter (compatible con el formato de chat de OpenAI), con respuesta en *streaming*.
- La API key se pide en un diálogo claro, se guarda en `localStorage`, no pasa por ningún servidor nuestro y se puede borrar con un clic. Dilo así en la interfaz.
- Selector de modelo con una lista corta. Consulta la lista vigente de modelos de OpenRouter y elige por defecto uno barato que soporte *tool calling*; no fijes nombres de modelo de memoria.
- Las herramientas son funciones puras con pruebas unitarias. Añade un conjunto pequeño de preguntas de evaluación con la respuesta esperada, para comprobar que el bot no inventa cifras.
- El chat es un panel plegable. Cerrado no ocupa espacio; sin API key, la app funciona completa.

## 7. Diseño visual y experiencia de uso

La referencia es una herramienta editorial de datos: sobria, rápida, con mucho aire. Antes de escribir componentes, define la dirección visual y los tokens (color, tipografía, espaciado, radios) y enséñamelos.

**Estructura**

- El mapa ocupa toda la pantalla. Encima, tres elementos: una barra superior fina (nombre, búsqueda, modos Explorar / Comparar / Recorrido), un selector de capa compacto y la leyenda. La ficha aparece a la derecha solo cuando hay un territorio seleccionado.
- En móvil, la ficha es una hoja inferior y el selector de capa un control horizontal.
- Una acción principal por pantalla. Lo secundario va detrás de un clic.

**Color**

- La interfaz es neutra (grises, blanco, un único color de acento). **El color se reserva para los datos.**
- Tres paletas y solo tres: secuencial, divergente y bivariada 3×3. Perceptualmente uniformes y legibles con daltonismo.
- "Sin dato" y "confidencial" tienen un estilo propio (gris con trama), distinto de cualquier valor.
- Tema claro por defecto y tema oscuro mediante los mismos tokens.

**Tipografía y números**

- Una sola familia sans-serif, con cifras tabulares en tablas y fichas. Escala corta: tres o cuatro tamaños.
- Formato `es-MX`: separadores de miles, porcentajes con un decimal, pesos y dólares diferenciados. Ningún número aparece sin unidad y año.

**Lo que no debe haber**

- Degradados decorativos, sombras marcadas, iconos de adorno, emojis, carruseles, ventanas emergentes al entrar, animaciones de más de 200 ms, textos de relleno ni tarjetas que repiten lo que ya dice el mapa.
- Más de un nivel de paneles anidados.

**Calidad**

- Accesibilidad WCAG AA: contraste, foco visible, todo operable con teclado, y una tabla alternativa accesible para los datos del mapa.
- Estados de carga, vacío y error diseñados, no improvisados.
- Objetivos: Lighthouse ≥ 90 en rendimiento y accesibilidad; interacción con el mapa fluida en un portátil normal.

Comprueba el resultado mirándolo: levanta la app, toma capturas en escritorio y móvil, y corrige lo que se vea recargado o desalineado antes de darme una fase por terminada.

## 8. Calidad del código

- **Python:** tipado completo, `ruff` para formato y lint, `pyright` para tipos, `pytest`. Funciones pequeñas y puras en `transform/`. Polars para tablas y GeoPandas solo donde haga falta geometría.
- **TypeScript:** modo `strict`, sin `any`. Biome para formato y lint. Vitest para funciones puras (escalas, formato, herramientas del bot) y Playwright para una prueba de humo de los flujos principales.
- Nombres que se explican solos. Comentarios solo para el porqué, no para repetir el código.
- Nada de abstracciones anticipadas, código muerto ni dependencias que se puedan resolver con veinte líneas. Antes de añadir una librería, justifica que hace falta.
- Componentes y módulos cortos, con una sola responsabilidad.
- Commits pequeños con formato *Conventional Commits*.
- GitHub Actions en cada push: lint, tipos, pruebas y build, tanto de `pipeline/` como de `web/`.
- `README.md` en español: qué es, captura, cómo ejecutarlo en local, cómo regenerar los datos, fuentes y licencias, cómo contribuir.
- `CLAUDE.md` breve con las convenciones de este documento, los comandos habituales y la regla del catálogo como fuente de verdad.

## 9. Plan de trabajo

Trabaja por fases. Al cerrar cada una, haz commit, resume en pocas líneas qué quedó hecho y qué decidiste, y espera mi visto bueno donde se indica.

**Fase 0 — Base.** Estructura del repositorio, `uv` y `pnpm` configurados, lint, tipos, pruebas y CI funcionando con un "hola mundo" en cada lado. Crea el repositorio público en GitHub con `gh` (nombre propuesto: `geografia-de-la-dependencia`; confírmalo conmigo antes de crearlo) y sube el primer commit.

**Fase 1 — Fuentes. ⏸ Espera mi aprobación.** Verifica cada fuente candidata y escribe `docs/fuentes.md`: qué variable, en qué nivel geográfico, qué años, formato de descarga o API, licencia o términos de uso, y limitaciones. Señala qué indicadores existen a nivel municipal y cuáles solo estatal. Si una fuente no ofrece lo que esperábamos, propón un sustituto o que el indicador quede solo a nivel estatal. No construyas interfaz hasta que apruebe este documento.

**Fase 2 — Especificación. ⏸ Espera mi aprobación.** `docs/spec.md` con el catálogo definitivo de indicadores, el esquema de los artefactos, las herramientas del bot y la dirección visual con sus tokens.

**Fase 3 — Pipeline.** Descarga, transformación, validación y exportación de las cuatro capas a nivel estatal y, donde exista, municipal. Geometrías simplificadas. `catalog.json` completo.

**Fase 4 — Mapa estatal.** Vista Explorar con las cuatro capas, leyenda, búsqueda, ficha y estado en la URL.

**Fase 5 — Nivel municipal.** Paso de entidad a municipio, carga diferida y tratamiento de los valores sin dato.

**Fase 6 — Comparar, contraargumento y metodología.**

**Fase 7 — Bot.**

**Fase 8 — Recorrido.**

**Fase 9 — Pulido y despliegue.** Accesibilidad, rendimiento, revisión visual con capturas, README y despliegue en Vercel. Para el inicio de sesión en Vercel y GitHub, pídeme que lo haga yo.

## 10. Criterios de aceptación

- `uv run pipeline build` regenera todos los artefactos desde cero en una máquina limpia.
- Cada cifra visible se puede rastrear hasta su fuente desde la propia interfaz.
- Ningún indicador muestra un valor inventado, imputado o sin año.
- La app es utilizable sin leer instrucciones y sin API key.
- El bot responde con fuente y año, y rechaza lo que queda fuera de los datos.
- CI en verde. Sin advertencias de lint ni de tipos.
- La pantalla principal cabe en una captura sin que nada sobre.

## 11. Cómo trabajar conmigo

- Las decisiones de la sección 2 ya están tomadas. Para todo lo demás, si una duda cambia la arquitectura o el alcance, pregúntame; si es un detalle, decide tú y anótalo en `docs/decisiones.md`.
- Si usas un flujo de especificación y planificación (por ejemplo, Superpowers), toma este documento como el resultado de la fase de ideación y pasa directo a diseño y plan.
- Cuando algo no se pueda hacer como está descrito, dímelo con la alternativa más simple en lugar de construir un rodeo.
- Prefiero menos funciones bien terminadas que todas a medias.
