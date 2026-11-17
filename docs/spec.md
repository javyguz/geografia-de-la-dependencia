# Especificación de la v1

Resultado de la fase 2. Define qué indicadores tendrá la app, cómo son los archivos que produce el pipeline, qué herramientas usa el bot y cómo se ve la interfaz. Parte del [planteamiento](brief.md) y de las [fuentes verificadas](fuentes.md).

**Estado:** pendiente de aprobación.

## 1. Alcance acordado

Decisiones tomadas al aprobar la fase 1:

| Tema | Decisión |
|---|---|
| Capa 1 | Solo estatal. Al acercarse a municipio, el mapa mantiene el valor de la entidad y lo dice. |
| Universo de la capa 1 | Las unidades económicas grandes. La participación del capital extranjero se calcula sobre ellas, no sobre el total censado. |
| Capa 2 | Solo estatal: mapa bivariado de 32 entidades. |
| Salarios municipales | Remuneración media de los Censos Económicos. El IMSS queda fuera de la v1. |
| Municipios posteriores a 2020 | "Sin dato" en las tasas por habitante. |

Dos consecuencias de la verificación que conviene tener presentes:

- **El capital extranjero no se compara en el tiempo.** El censo de 2019 definía "unidad grande" de otra forma (50 millones de pesos de ingresos o 50 personas ocupadas) que el de 2024 (100 millones, o exportadoras con 10 millones). La capa 1 muestra solo 2023.
- **Las capas 3 y 4 sí se comparan.** El INEGI publica los censos anteriores recalculados con el clasificador actual, también por municipio. La v1 usa 2023 y 2018.

## 2. Catálogo de indicadores

Cada capa lleva como nombre la pregunta que responde. Los identificadores van en inglés porque son código; los nombres visibles, en español.

### Capa 1 — ¿Cuánto pesa el capital extranjero?

Estatal, 2023, por sector. Universo: unidades económicas grandes del sector privado y paraestatal.

| Id | Nombre | Fórmula | Unidad |
|---|---|---|---|
| `foreign_share_value_added` | Valor agregado en unidades con capital extranjero | VACB de unidades grandes con capital extranjero ÷ VACB de unidades grandes | % |
| `foreign_share_employment` | Personal ocupado en unidades con capital extranjero | Personal ocupado, misma razón | % |
| `foreign_share_wages` | Remuneraciones pagadas por unidades con capital extranjero | Remuneraciones, misma razón | % |
| `large_units_coverage` | Cuánto de la economía cubren las unidades grandes | VACB de unidades grandes ÷ VACB total censado | % |

`large_units_coverage` no se pinta en el mapa: acompaña siempre a los otros tres en la ficha, para que el lector sepa qué parte de la economía de esa entidad describe la cifra.

Fuente: Censos Económicos 2024, cuadro `CAPEXCE24_01`; el denominador de `large_units_coverage` sale de los datos abiertos.

### Capa 2 — ¿Derrama o enclave?

Estatal. Mapa bivariado: un indicador de integración externa contra uno de condiciones de trabajo, cada uno en terciles.

| Eje | Id | Nombre | Fórmula | Unidad y año |
|---|---|---|---|---|
| Integración | `foreign_share_value_added` | El de la capa 1 | | %, 2023 |
| Integración | `exports_per_capita` | Exportaciones por habitante | Exportaciones de mercancías ÷ población | Dólares; exportaciones 2023, población 2020 |
| Integración | `fdi_per_capita` | IED acumulada por habitante | Suma de flujos de IED 2019-2023 ÷ población | Dólares; IED 2019-2023, población 2020 |
| Condiciones | `informality_rate` | Tasa de informalidad laboral | Promedio de los cuatro trimestres | %, 2023 |
| Condiciones | `working_poverty_rate` | Población en pobreza laboral | Promedio de los cuatro trimestres | %, 2023 |
| Condiciones | `wage_per_paid_worker` | El de la capa 3 | | Pesos, 2023 |

Combinación por defecto: `foreign_share_value_added` contra `informality_rate`.

En el eje de condiciones, "alto" significa siempre mejores condiciones. Los indicadores en los que un valor mayor es peor (informalidad, pobreza laboral) se invierten al clasificar; el catálogo lo marca con `higher_is_better: false`, y la leyenda y la ficha muestran el valor original.

`fdi_per_capita` muestra siempre la advertencia sobre la IED. Su texto se redactará en la fase 3 con dos hechos comprobables: que la asignación a cada entidad depende de lo que reportan las empresas y del criterio de la Secretaría de Economía, y qué porcentaje del total concentra la Ciudad de México según el propio archivo.

Fuentes: INEGI (exportaciones por entidad, ENOE, Pobreza Laboral, Censo 2020) y Secretaría de Economía.

### Capa 3 — ¿Quién se queda con el valor?

Estatal y municipal, 2023 y 2018, por sector.

| Id | Nombre | Fórmula | Unidad |
|---|---|---|---|
| `labor_share` | Parte del valor agregado que se paga en remuneraciones | Remuneraciones ÷ VACB | % |
| `value_added_per_worker` | Valor agregado por persona ocupada | VACB ÷ personal ocupado | Miles de pesos |
| `wage_per_paid_worker` | Remuneración media por persona remunerada | Remuneraciones ÷ personal remunerado | Miles de pesos |

`labor_share` es un indicador aproximado del reparto entre trabajo y capital. La nota metodológica dirá qué deja fuera: el ingreso de propietarios y familiares sin sueldo, el personal contratado por otra razón social y todo lo que el censo no capta (agricultura, gobierno, economía sin establecimiento fijo). Puede superar 100 % cuando una unidad paga más en remuneraciones que el valor que agrega; ese valor se muestra tal cual. Si el valor agregado es cero o negativo, el indicador queda como "sin dato" con el motivo "no calculable".

Los importes en pesos son corrientes. Entre 2018 y 2023 solo se comparan los indicadores que son razones (`labor_share`); los importes de 2018 se muestran sin calcular variación.

Fuente: Censos Económicos, datos abiertos.

### Capa 4 — ¿Quién da el empleo?

Estatal y municipal, 2023 y 2018, por sector, salvo donde se indica.

| Id | Nombre | Fórmula | Unidad | Cobertura |
|---|---|---|---|---|
| `large_establishment_employment_share` | Empleo en establecimientos de 251 personas o más | Personal ocupado del estrato ÷ personal ocupado total | % | |
| `micro_establishment_employment_share` | Empleo en establecimientos de hasta 10 personas | Misma razón | % | |
| `establishments_per_1000` | Establecimientos por cada mil habitantes | Unidades económicas ÷ población × 1,000 | Número; unidades 2023, población 2020 | Sin sector |
| `immex_employment_share` | Peso del empleo IMMEX en la manufactura | Personal ocupado IMMEX manufacturero ÷ personal ocupado manufacturero censado | %, 2023 | Solo estatal, 17 entidades |

`immex_employment_share` combina dos fuentes con conceptos distintos de personal ocupado. Si en la fase 3 el resultado no es coherente (por ejemplo, valores por encima de 100 %), el indicador se retira y se anota en [decisiones.md](decisiones.md).

Fuentes: Censos Económicos, datos abiertos; INEGI, IMMEX; Censo 2020.

### El contraargumento

Indicadores que pueden contradecir la tesis. Se calculan igual que los demás y viven en el mismo catálogo.

| Id | Nombre | Fórmula | Nivel |
|---|---|---|---|
| `wage_per_paid_worker_foreign` | Remuneración media en unidades grandes con capital extranjero | Remuneraciones ÷ personal remunerado | Estatal |
| `wage_per_paid_worker_domestic` | Remuneración media en unidades grandes sin capital extranjero | Misma razón | Estatal |
| `labor_share_foreign` | Parte del valor agregado pagada en remuneraciones, con capital extranjero | Remuneraciones ÷ VACB | Estatal |
| `labor_share_domestic` | La misma, sin capital extranjero | Misma razón | Estatal |
| `unpaid_worker_share_micro` | Personal sin sueldo en establecimientos de hasta 10 personas | Propietarios, familiares y otros no remunerados ÷ personal ocupado del estrato | Estatal y municipal |

El panel presenta los dos primeros pares uno junto al otro. El quinto sustituye a la "informalidad en las unidades micro" del planteamiento: la informalidad por tamaño de unidad no está en las fuentes verificadas, y el personal sin sueldo es lo más cercano que publica el censo. No se llamará informalidad.

### Sectores

Los sectores SCIAN de dos dígitos que traen los Censos Económicos, más el total. Los indicadores que no vienen de los censos no tienen desglose por sector.

### Lo que queda fuera de la v1

DENUE, IMSS, país de origen del capital extranjero, series trimestrales (se usa el promedio anual) y años anteriores a 2018.

## 3. Artefactos

El pipeline escribe en `web/public/data/`. Todo es JSON o GeoJSON y se versiona.

```
catalog.json
territories.json
geo/states.geojson
geo/municipalities.geojson        o municipalities.pmtiles
values/states.json
values/municipalities.json
values/municipalities-sectors/{EE}.json
```

| Archivo | Contenido | Cuándo se carga |
|---|---|---|
| `catalog.json` | Capas, indicadores, sectores, fuentes y motivos de "sin dato" | Al inicio |
| `territories.json` | Clave, nombre, nivel, entidad a la que pertenece y población de cada territorio; alimenta la búsqueda | Al inicio |
| `geo/states.geojson` | 32 entidades simplificadas | Al inicio |
| `values/states.json` | Todos los indicadores estatales, con sectores y el valor nacional | Al inicio |
| `geo/municipalities.*` | 2,478 municipios simplificados | Al acercarse o entrar a una entidad |
| `values/municipalities.json` | Indicadores municipales del total de sectores | Con la geometría municipal |
| `values/municipalities-sectors/{EE}.json` | Indicadores municipales por sector, un archivo por entidad | Al elegir un sector dentro de una entidad |

Las geometrías municipales serán un GeoJSON único si, simplificadas, pesan 1.5 MB o menos comprimidas; si no, PMTiles.

### `catalog.json`

```jsonc
{
  "generated_at": "2026-11-20",
  "sources": [{
    "id": "ce2024_open_data",
    "name": "Censos Económicos 2024, datos abiertos",
    "institution": "INEGI",
    "url": "https://www.inegi.org.mx/programas/ce/2024/",
    "license": "Términos de Libre Uso de la Información del INEGI",
    "license_url": "https://www.inegi.org.mx/inegi/terminos.html",
    "retrieved_at": "2026-11-18"
  }],
  "sectors": [{ "id": "31-33", "name": "Industrias manufactureras" }],
  "missing_reasons": [{ "id": "confidential", "label": "Confidencial" }],
  "layers": [{
    "id": "value_split",
    "question": "¿Quién se queda con el valor?",
    "indicators": ["labor_share", "value_added_per_worker", "wage_per_paid_worker"]
  }],
  "indicators": [{
    "id": "labor_share",
    "name": "Parte del valor agregado que se paga en remuneraciones",
    "definition": "…",
    "formula": "Remuneraciones ÷ valor agregado censal bruto",
    "unit": "percent",
    "decimals": 1,
    "scale": "sequential",
    "sources": ["ce2024_open_data"],
    "levels": ["state", "municipality"],
    "years": [2023, 2018],
    "by_sector": true,
    "coverage": "Sector privado y paraestatal captado por el censo",
    "limitations": ["…"]
  }]
}
```

Unidades admitidas: `percent`, `mxn_thousands`, `mxn`, `usd`, `count`. El frontend decide el formato a partir de `unit` y `decimals`; no hay textos de formato en el catálogo.

Motivos de "sin dato": `confidential` (suprimido por el INEGI), `not_published` (la fuente no publica ese territorio), `not_collected` (el censo no pudo captar el municipio), `not_computable` (denominador cero o negativo) y `no_population` (municipio sin población censal).

### Archivos de valores

Formato por columnas: una lista de territorios y, por cada serie, un arreglo de valores en el mismo orden.

```jsonc
{
  "level": "state",
  "territories": ["00", "01", "02"],
  "series": [{
    "indicator": "labor_share",
    "sector": "total",
    "year": 2023,
    "values": [0.221, 0.312, null],
    "missing": { "2": "confidential" }
  }]
}
```

- `"00"` es el valor nacional y solo aparece en el archivo estatal.
- Los porcentajes se guardan como proporción (0.312), no multiplicados por cien.
- Todo `null` tiene su motivo en `missing`, con el índice del territorio como clave.

### Lo que valida el pipeline antes de exportar

- Las claves de `territories` existen en la geometría del mismo nivel, y a la inversa.
- 32 entidades, sin duplicados.
- Las participaciones (`*_share` de capital extranjero y de estratos, `large_units_coverage`) están entre 0 y 1. `labor_share` solo se exige no negativo.
- Ningún valor nulo sin motivo y ningún motivo sin valor nulo.
- Cada indicador del catálogo tiene al menos una serie, y cada serie apunta a un indicador, sector y año del catálogo.
- Los totales nacionales calculados coinciden con los que publica el INEGI.

## 4. El bot

El modelo recibe el diccionario de datos (capas, indicadores, sectores y motivos de "sin dato", derivados de `catalog.json`) y estas herramientas, que se ejecutan en el navegador:

| Herramienta | Parámetros | Devuelve |
|---|---|---|
| `find_territory` | `query` | Hasta cinco territorios cuyo nombre coincide, con clave, nivel y entidad |
| `describe_indicator` | `indicator` | Definición, fórmula, unidad, años, niveles, cobertura, limitaciones y fuente |
| `get_value` | `indicator`, `territory`, `sector?`, `year?` | El valor con todo su contexto |
| `compare` | `indicator`, `territories` (2 a 5), `sector?`, `year?` | Un valor por territorio, más el nacional |
| `rank` | `indicator`, `level`, `order`, `limit?`, `within_state?`, `sector?`, `year?` | Los primeros o últimos territorios, y cuántos no tienen dato |
| `show_on_map` | `indicator`, `territory?`, `sector?`, `year?` | Mueve el mapa y confirma lo que quedó a la vista |

`find_territory` no estaba en el planteamiento. Hace falta porque el modelo no puede conocer las claves de 2,478 municipios, y varios comparten nombre.

Todo valor devuelto por una herramienta tiene esta forma:

```jsonc
{
  "indicator": "labor_share",
  "indicator_name": "Parte del valor agregado que se paga en remuneraciones",
  "territory": "08037",
  "territory_name": "Juárez, Chihuahua",
  "sector": "total",
  "year": 2023,
  "value": 0.284,
  "formatted": "28.4 %",
  "missing_reason": null,
  "source": "INEGI, Censos Económicos 2024",
  "source_url": "https://www.inegi.org.mx/programas/ce/2024/"
}
```

Reglas del sistema:

- Toda cifra de una respuesta sale de una herramienta, en el mismo turno, y se cita con indicador, territorio, año y fuente.
- Si el valor no existe, el bot dice el motivo y no ofrece una estimación.
- Si la pregunta queda fuera de los datos, lo dice y propone dos o tres preguntas que sí puede responder.
- No interpreta la tesis ni opina.

Las herramientas son funciones puras sobre los datos cargados. Las que necesitan municipios piden primero el archivo correspondiente. El modelo por defecto y la lista corta se eligen en la fase 7 consultando el catálogo vigente de OpenRouter.

**Evaluación.** Un archivo con unas doce preguntas y su resultado esperado: valores exactos, un ranking, una comparación, un territorio ambiguo, un dato confidencial, un indicador que no existe a nivel municipal y dos preguntas fuera de alcance. Se ejecuta a mano con una API key; las herramientas se prueban aparte con Vitest.

## 5. Dirección visual

### Idea

Una hoja cartográfica, no un tablero. El mapa es la página y la interfaz es su margen: una barra, una leyenda y una ficha, en gris y blanco, sin sombras ni tarjetas.

**Tres paletas, dos tintas.** Todo el color de la app sale de dos tonos: añil, el azul violáceo del tinte mesoamericano, y ocre. La paleta secuencial es añil; la divergente va de añil a ocre pasando por gris; la bivariada cruza las dos. El único acento de la interfaz es el añil más oscuro. Así el lector aprende un solo código de color.

Dos razones para elegir estos tonos:

- El eje azul-amarillo es el que mejor se conserva con las formas comunes de daltonismo.
- En México casi todos los colores saturados tienen lectura partidista. Ningún par de tonos está libre de asociaciones, pero la app evita las más cargadas hoy: el guinda y la combinación verde, blanco y rojo.

### Color

**Interfaz**

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `surface` | `#ffffff` | `#161718` | Barra, leyenda, ficha |
| `canvas` | `#eef0f2` | `#0e0f10` | Fondo del mapa |
| `panel` | `#f4f5f6` | `#1f2123` | Filas alternas, campos |
| `border` | `#d9dcdf` | `#34373a` | Líneas de 1 px |
| `text` | `#1a1c1f` | `#eceef0` | Texto y cifras |
| `text-muted` | `#5c6066` | `#a4a9b0` | Unidades, fuentes, notas |
| `accent` | `#3a47a8` | `#a2b4f5` | Enlaces, foco, modo activo |

Contrastes medidos: texto 17.1:1, texto atenuado 6.3:1 y acento 7.9:1 sobre blanco; en oscuro, 15.4:1, 7.6:1 y 8.9:1.

**Datos**

| Paleta | Valores, de menor a mayor |
|---|---|
| Secuencial (5 clases) | `#d3ddfd` `#a2b4f5` `#6d83e6` `#4657bd` `#283380` |
| Divergente (5 clases) | `#4657bd` `#a2b4f5` `#e6e6e4` `#e1ab7b` `#8f5208` |
| Sin dato | `#d5d6d8` con trama a 45° en `#a9acb0` |
| Confidencial | El mismo gris con trama a 135° |

Bivariada 3×3. Las columnas son la integración externa y las filas las condiciones de trabajo, ambas de baja a alta:

| | Integración baja | media | alta |
|---|---|---|---|
| **Condiciones altas** | `#da720d` | `#96570f` | `#40260b` |
| **medias** | `#fcb17e` | `#ae8888` | `#4b3f76` |
| **bajas** | `#e9e9e7` | `#a1b4f8` | `#4556d9` |

Comprobaciones hechas con el validador de paletas, simulando protanopia y deuteranopia:

- Secuencial: claridad monótona, saltos uniformes y un solo tono. La clase más clara tiene poco contraste con el blanco (1.35:1) a propósito; por eso el mapa va sobre `canvas` y cada polígono lleva un borde.
- Bivariada: la pareja de colores más parecida queda a una distancia de 12.0 con daltonismo y 12.6 con visión normal. Las cuatro bivariadas de uso común que medí quedan entre 2.2 y 6.5 con daltonismo.
- Ninguna paleta depende solo del color: la leyenda resalta la clase del territorio señalado, la ficha da el valor en texto y existe la tabla alternativa.

En el tema oscuro la secuencial se invierte (lo más alto es lo más claro) y el punto medio de la divergente pasa a `#383a3d`. La bivariada oscura se generará con el mismo procedimiento y se validará en la fase 4; es lo único de esta sección que no está medido.

**Clasificación.** Cinco clases por cuantiles para la secuencial y terciles por eje para la bivariada, calculados sobre todos los territorios del nivel visible, de modo que los colores no cambian al moverse por el mapa. La divergente se usa para la diferencia frente al valor nacional.

**Selección.** El territorio elegido se marca con un contorno de 2 px en `text` y un halo de 1 px en `surface`, que se ve sobre cualquier clase. El acento no se usa dentro del mapa.

### Tipografía

Una sola familia: **Archivo**, de la fundición argentina Omnibus-Type. Es una grotesca pensada para titulares y datos, cubre el español completo y tiene cifras tabulares (comprobado en el archivo de la fuente). Se autoaloja; el navegador no pide nada a terceros.

| Token | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| `text-xs` | 12 / 16 | 400 | Fuentes, notas, ejes de las gráficas |
| `text-sm` | 14 / 20 | 400 y 500 | Interfaz, leyenda, tablas |
| `text-base` | 16 / 24 | 400 | Párrafos del recorrido y de metodología |
| `text-xl` | 28 / 32 | 600 | El valor de la ficha y los títulos de página |

Las cifras de tablas, fichas y leyendas usan `tabular-nums`. No hay mayúsculas sostenidas ni cursivas decorativas.

### Espaciado, radios y movimiento

| Token | Valor |
|---|---|
| Espaciado | Múltiplos de 4 px: 4, 8, 12, 16, 24, 32 |
| Radio | 2 px en controles y paneles; 0 en el mapa y la leyenda |
| Borde | 1 px en `border`; sin sombras |
| Ancho de la ficha | 360 px en escritorio; hoja inferior en móvil |
| Altura de la barra | 48 px |
| Movimiento | 150 ms, solo al abrir la ficha, cambiar de capa y volar a un territorio; se anula con `prefers-reduced-motion` |

### Estructura

Escritorio:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Geografía de la dependencia   [ Buscar ]    Explorar Comparar Recorrido │
├──────────────────────────────────────────────────────┬───────────────┤
│ ┌ ¿Quién se queda con el valor? ▾ ┐                  │ Juárez, Chih. │
│ │ Indicador ▾   Sector ▾   2023 ▾ │                  │               │
│ └─────────────────────────────────┘                  │ 28.4 %        │
│                                                      │ 2023 · puesto │
│                      MAPA                            │ 1,204 de 2,431│
│                                                      │ Nacional 22.1%│
│ ┌ Leyenda ────────────┐                              │ ▂▃▅▇ gráfica  │
│ │ ▢▢▢▢▢  ▨ sin dato   │                              │               │
│ │ Fuente: INEGI, 2023 │               El contraargumento ▸ │ Fuente ↗ │
│ └─────────────────────┘                              │               │
└──────────────────────────────────────────────────────┴───────────────┘
```

Móvil:

```
┌───────────────────────────┐
│ Geografía…   [buscar] [≡] │
│ ‹ Capital · Derrama · Va… ›│
│                           │
│           MAPA            │
│                           │
│ ▢▢▢▢▢ ▨   INEGI, 2023     │
├───────────────────────────┤
│ Juárez, Chih.     28.4 %  │  hoja inferior
└───────────────────────────┘
```

- El selector de capa muestra la pregunta completa. Indicador, sector y año son tres listas en una fila.
- La leyenda siempre incluye la unidad, el año y la fuente. En la capa 2 es la cuadrícula 3×3 con sus dos ejes rotulados.
- "El contraargumento" es un botón fijo y siempre visible en el borde inferior del mapa; abre su panel en el lugar de la ficha.
- El chat se abre desde la barra y ocupa también el lugar de la ficha. Nunca hay dos paneles a la vez.
- La tabla alternativa accesible se abre desde la leyenda ("Ver como tabla").

### Estado en la URL

`?capa=valor&ind=labor_share&sector=31-33&anio=2023&t=08037&cmp=08037,19039&modo=comparar`

| Parámetro | Contenido |
|---|---|
| `capa` | Capa activa |
| `ind`, `ind2` | Indicador; `ind2` es el segundo eje de la capa 2 |
| `sector`, `anio` | Sector y año |
| `t` | Territorio seleccionado (`CVEGEO`) |
| `cmp` | Territorios en comparación, separados por comas |
| `modo` | `explorar` (por defecto), `comparar` o `recorrido` |

Los valores por defecto no se escriben en la URL.
