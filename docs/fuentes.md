# Fuentes de datos

Resultado de la fase 1: qué ofrece realmente cada fuente candidata del [planteamiento](brief.md), a qué nivel geográfico, para qué años y con qué restricciones.

- **Fecha de verificación:** 16 de noviembre de 2026.
- **Método:** cada archivo marcado como *verificado* se descargó y se abrió; las variables, la cobertura y las notas se leyeron del propio archivo o de su diccionario de datos, no de descripciones de terceros.
- **Estado:** pendiente de aprobación. No se construye interfaz ni pipeline hasta que se apruebe.

## 1. Lo que cambia respecto al planteamiento

Cinco hallazgos obligan a ajustar el plan. Los demás supuestos se confirmaron.

1. **El capital extranjero solo existe a nivel estatal y solo para las "unidades económicas grandes".** Los Censos Económicos publican la participación de capital extranjero por entidad y actividad, pero no por municipio, y únicamente para los establecimientos que el INEGI clasifica como grandes. La capa 1 no puede bajar a municipio con datos públicos.
2. **La capa 2 (mapa bivariado) tampoco puede ser municipal.** Todas las medidas de integración externa (capital extranjero, exportaciones, IED) son estatales. La única excepción parcial es IMMEX, que publica un conjunto reducido de municipios.
3. **La advertencia sobre la IED del planteamiento ya no describe la metodología vigente.** Desde 2015 la Secretaría de Economía asigna la IED según la "presencia operativa real" de las empresas, no según su domicilio fiscal, y revisó la serie 1999-2014 con ese criterio. La advertencia debe reescribirse (ver [sección 4.6](#46-inversión-extranjera-directa-por-entidad-secretaría-de-economía)).
4. **El portal de datos abiertos del IMSS no se pudo verificar.** Responde con una verificación antibots (error 403 y CAPTCHA) a cualquier acceso automatizado. Es la única fuente municipal de salarios distinta de los Censos Económicos, así que su ausencia afecta al eje de condiciones de trabajo a nivel municipal.
5. **No hace falta ningún token.** Todas las fuentes del INEGI verificadas se descargan como archivos directos, sin la API de indicadores ni la del DENUE. El pipeline no necesitará `.env` salvo que se decida lo contrario.

## 2. Disponibilidad por indicador

| Capa | Indicador | Estatal | Municipal | Años | Fuente |
|---|---|---|---|---|---|
| 1 | Participación de unidades con capital extranjero en personal ocupado, valor agregado y remuneraciones | Sí, solo unidades grandes | **No existe** | 2023, 2018 | Censos Económicos, tabulado temático |
| 2, integración | Participación de capital extranjero | Sí, solo unidades grandes | No | 2023, 2018 | Censos Económicos |
| 2, integración | Exportaciones de mercancías | Sí | No | 2007-2025 | INEGI, exportaciones por entidad |
| 2, integración | IED recibida | Sí | No | 1999-2026 | Secretaría de Economía |
| 2, integración | Ventas al exterior de las unidades grandes | Sí | No | 2023 | Censos Económicos, tabulado temático |
| 2, condiciones | Tasa de informalidad laboral | Sí | No | 2005-2026, trimestral | ENOE |
| 2, condiciones | Pobreza laboral e ingreso laboral per cápita | Sí | No | 2005-2026, trimestral | INEGI, Pobreza Laboral |
| 2, condiciones | Remuneración media por persona remunerada | Sí | Sí, con supresión | 2023, 2018 | Censos Económicos |
| 2, condiciones | Salario base de cotización | Sin verificar | Sin verificar | Sin verificar | IMSS |
| 3 | Remuneraciones entre valor agregado censal bruto | Sí | Sí, con supresión | 2023, 2018 | Censos Económicos |
| 3 | Valor agregado y remuneración por persona ocupada | Sí | Sí, con supresión | 2023, 2018 | Censos Económicos |
| 4 | Unidades económicas y empleo por tamaño | Sí | Sí, con supresión | 2023, 2018 | Censos Económicos |
| 4 | Establecimientos por rango de personal | Sí | Sí | Edición 05/2026 | DENUE |
| 4 | Empleo en establecimientos IMMEX | 17 entidades | Municipios seleccionados | 2007-2026 | INEGI, IMMEX |

Las capas 3 y 4 se pueden construir completas a los dos niveles. Las capas 1 y 2 quedan a nivel estatal.

## 3. Decisiones que necesito

1. **Capa 1 solo estatal.** Propongo que, al acercarse a nivel municipal, la capa 1 siga mostrando el valor de la entidad con una nota explícita de que el dato no se publica por municipio. La alternativa (el Laboratorio de Microdatos del INEGI) exige acceso presencial y no es reproducible, así que la descarto.
2. **Denominador de la capa 1.** El tabulado solo cubre unidades grandes. Se puede calcular la participación sobre el total de unidades grandes o sobre el total de la economía censada. Propongo el segundo, porque responde a la pregunta de la capa, declarando que es una **cota inferior**: el capital extranjero en unidades no grandes no se mide. Cifras de referencia en la [sección 4.2](#42-censos-económicos-2024-participación-de-capital-extranjero).
3. **Capa 2 solo estatal.** Propongo el mapa bivariado con 32 entidades y sin paso a municipio.
4. **IMSS.** Hay tres caminos: que pruebes tú la descarga desde tu conexión y me confirmes si funciona; dejar el indicador fuera de la v1; o sustituirlo a nivel municipal por la remuneración media de los Censos Económicos, que ya está verificada. Propongo el tercero y revisar el IMSS más adelante.
5. **Población.** El Censo 2020 tiene 2,469 municipios y el marco de 2024 tiene 2,478. Los municipios creados después de 2020 no tienen población censal. Propongo mostrarlos como "sin dato" en las tasas per cápita en lugar de estimarlos; las proyecciones de CONAPO no las he verificado.

## 4. Fichas por fuente

### 4.1 Censos Económicos 2024, datos abiertos

*Verificado.*

- **Qué es:** resultados definitivos, con datos referidos a 2023. Un archivo CSV nacional y uno por entidad.
- **Nivel geográfico:** entidad y municipio (campos `E03` y `E04`). El catálogo incluido lista 2,478 municipios.
- **Desglose:** sector, subsector, rama, subrama y clase (SCIAN 2023), y estrato de personal ocupado: 0 a 10, 11 a 50, 51 a 250, 251 y más.
- **Variables útiles:** unidades económicas (`UE`), personal ocupado total (`H001A`), personal remunerado (`H010A`), remuneraciones (`J000A`), valor agregado censal bruto (`A131A`), producción bruta total (`A111A`), ingresos por maquila (`M700A`). Valores monetarios en millones de pesos.
- **Descarga:** `https://www.inegi.org.mx/contenidos/programas/ce/2024/datosabiertos/conjunto_de_datos_ce_nac_2024_csv.zip` para el nacional (2 MB) y `conjunto_de_datos_ce_{abreviatura}_2024_csv.zip` por entidad (Aguascalientes: `ags`, 1.5 MB).
- **Confidencialidad:** "supresión parcial con datos complementarios". En los renglones con problema de confidencialidad se conserva el número de unidades económicas y se dejan vacías las variables económicas. El estrato `99` agrupa estratos por confidencialidad.
- **Alcance de la supresión:** en Aguascalientes, 8,450 de 13,589 renglones municipales no traen valor agregado. La mayoría son renglones de clase de actividad; los totales municipales y por sector están mucho más completos. La proporción exacta por nivel se medirá en la fase 3.
- **Limitaciones:**
  - En Chiapas no se captó información en 6 municipios y se captó parcialmente en 11, según la nota del propio INEGI.
  - Los estratos del archivo son rangos fijos de personal; no coinciden exactamente con la definición oficial de micro, pequeña, mediana y grande, que varía por sector.
  - El archivo nacional contiene solo totales nacionales; los municipios están en los archivos por entidad.

**Serie histórica.** El mismo apartado de datos abiertos publica un "Comparativo 2019-2004 con base al clasificador SCIAN 2023" para los censos 2019, 2014, 2009 y 2004, nacional y por entidad. Existe y es la vía correcta para comparar en el tiempo; no he abierto esos archivos para confirmar que traen municipios. Los datos abiertos originales del censo 2019 también siguen disponibles (`ce2019_ags_csv.zip`).

### 4.2 Censos Económicos 2024, participación de capital extranjero

*Verificado.*

- **Qué es:** tabulado temático "Participación de capital extranjero en las unidades económicas grandes, características principales, por entidad federativa y hasta clase de actividad económica" (cuadro `CAPEXCE24_01`).
- **Nivel geográfico:** nacional y 32 entidades. **No hay municipios.**
- **Desglose:** actividad hasta clase, y nivel de participación: sin capital extranjero; hasta 25 %; más de 25 y hasta 50 %; más de 50 y hasta 75 %; más de 75 y hasta 90 %; más de 90 %.
- **Variables:** unidades económicas, personal ocupado, remuneraciones, producción bruta, consumo intermedio, valor agregado censal bruto, formación bruta de capital fijo e indicadores por persona.
- **Descarga:** `https://www.inegi.org.mx/contenidos/programas/ce/2024/tabulados/capexce24_01.xlsx` (23 MB, 119,568 renglones).
- **Qué es una unidad grande:** el tabulado lo define con seis criterios. Los dos principales son empresas con ingresos de 100 millones de pesos o más, y empresas exportadoras con ingresos de 10 millones o más. Los demás cubren empresas eléctricas, petroleras, comercializadoras de combustible y de economía digital.
- **Limitaciones:**
  - El capital extranjero es **declarado por la propia unidad**: "el reconocimiento de las unidades económicas se obtiene de su declaración de contar con capital extranjero en su capital social".
  - El universo es el sector privado y paraestatal captado en zona urbana.
  - Los renglones "Todos" agrupan niveles de participación por confidencialidad, y hay celdas vacías por el mismo motivo, sobre todo a nivel de clase de actividad.

**Cifras nacionales de referencia** (cálculo propio y preliminar sobre los archivos descargados; se validará en la fase 3):

| | Unidades grandes | De ellas, con capital extranjero | Total censado (sector privado y paraestatal) |
|---|---|---|---|
| Unidades económicas | 328,077 | 26,319 | 5,468,180 |
| Personal ocupado | 14,870,239 | 4,387,523 | 27,965,433 |
| Remuneraciones (millones de pesos) | 2,897,953 | 1,026,473 | 3,474,423 |
| Valor agregado censal bruto (millones de pesos) | 13,383,674 | 4,846,067 | 15,667,990 |

De ahí salen dos lecturas posibles de la misma capa, con datos de 2023:

- Sobre las unidades grandes, las que tienen capital extranjero concentran 29.5 % del personal ocupado, 35.4 % de las remuneraciones y 36.2 % del valor agregado.
- Sobre el total censado, concentran al menos 15.7 % del personal, 29.5 % de las remuneraciones y 30.9 % del valor agregado.

Las unidades grandes son 6.0 % de los establecimientos, pero generan 85.4 % del valor agregado, así que la cota inferior queda cerca del valor real para el valor agregado y más lejos para el empleo. Los dos universos no son idénticos (el de unidades grandes es urbano), lo que habrá que declarar en la nota metodológica.

**Tabulados hermanos, misma estructura y mismas limitaciones:**

- País de origen del capital extranjero: `capexce24_02.xlsx`.
- Ventas en el exterior de las unidades grandes, por entidad: `mdoexce24_02.xlsx`.
- Compras en el exterior de las unidades grandes, por entidad: `mdoexce24_01.xlsx`.
- Participación de capital extranjero en las mil empresas más grandes: `milence24_03.xlsx`.

**Censo 2019.** Existe el tabulado equivalente con datos de 2018 (`/programas/ce/2019/tabulados/capexce19_01.xlsx`, 66 MB), también para unidades grandes. Falta confirmar que la definición de "grande" es la misma en los dos censos antes de comparar.

### 4.3 Exportaciones por entidad federativa (INEGI)

*Verificado.*

- **Qué es:** valor de las exportaciones de mercancías por entidad y subsector SCIAN, en miles de dólares.
- **Nivel geográfico:** 32 entidades. No hay municipios.
- **Años:** anual 2007-2025 (2025 preliminar) y trimestral 2007-2026 segundo trimestre.
- **Descarga:** `https://www.inegi.org.mx/contenidos/programas/exporta_ef/tabulados/EAEF_Entidad_Subsector.xlsx` (anual, una hoja por entidad) y `EAEF_Entidad.xlsx`; las versiones trimestrales empiezan por `ETEF_`.
- **Limitaciones:**
  - Las celdas con `C` están suprimidas por confidencialidad y las que tienen `-` no aplican. Ninguna es un cero.
  - Cubre minería, manufacturas y parte del sector agropecuario; no todas las exportaciones del país se pueden asignar a una entidad. El catálogo del INEGI indica que en 2025 se asignó 90.6 % del total nacional.
  - Los subsectores agropecuarios tienen serie más corta que los manufactureros.

### 4.4 ENOE, informalidad laboral

*Verificado.*

- **Qué es:** tasas de informalidad laboral y de ocupación en el sector informal, por entidad y sexo.
- **Nivel geográfico:** nacional, 32 entidades y un conjunto de áreas urbanas. **No es representativa por municipio.**
- **Años:** trimestral, del primer trimestre de 2005 al segundo de 2026. Falta el segundo trimestre de 2020, cuando la encuesta se suspendió.
- **Descarga:** `https://www.inegi.org.mx/contenidos/programas/enoe/15ymas/tabulados/enoe_informalidad_tasas_xls.zip` (3 MB). El archivo `Tasas_Infor_enti-1.xlsx` trae una hoja por trimestre.
- **Limitaciones:** son estimaciones muestrales; el archivo que revisé trae las estimaciones puntuales, y los intervalos de confianza habrá que buscarlos en los tabulados de precisiones estadísticas.

### 4.5 Pobreza laboral (INEGI)

*Verificado.*

- **Qué es:** indicadores que antes publicaba el CONEVAL y hoy publica el INEGI con la ENOE como base. Incluye el porcentaje de población con ingreso laboral inferior al costo de la canasta alimentaria, el ingreso laboral per cápita y la masa salarial.
- **Nivel geográfico:** nacional, ámbito rural y urbano, 32 entidades y ciudades autorrepresentadas. No hay municipios.
- **Años:** trimestral, del primer trimestre de 2005 al segundo de 2026.
- **Descarga:** `https://www.inegi.org.mx/contenidos/desarrollosocial/pl/tabulados/pl_2005t_2026t.xlsx` (1 MB, 51 hojas). El cuadro 9 trae la pobreza laboral por entidad, el 5 el ingreso laboral per cápita por entidad y los cuadros 18 el ingreso laboral promedio por sector en cada entidad.
- **Limitaciones:** no es la medición oficial de pobreza; solo considera el ingreso laboral.

### 4.6 Inversión extranjera directa por entidad (Secretaría de Economía)

*Verificado el archivo de la Secretaría; el CSV de datos abiertos no se pudo descargar.*

- **Qué es:** flujos de IED por entidad, tipo de inversión, país de origen y actividad, en millones de dólares.
- **Nivel geográfico:** 32 entidades. No hay municipios.
- **Años:** trimestral. El archivo por entidad que abrí cubre de 2006 al segundo trimestre de 2026; la serie metodológicamente comparable empieza en 1999.
- **Descarga:** `https://www.gob.mx/cms/uploads/attachment/file/1100602/2026_2T_Flujos_EF_AC_5.xlsx` (7 MB). La dirección cambia cada trimestre; la página que enlaza siempre la versión vigente es `https://www.gob.mx/se/acciones-y-programas/competitividad-y-normatividad-inversion-extranjera-directa`.
- **Datos abiertos:** el mismo contenido está en `datos.gob.mx` (conjunto `inversion_extranjera_directa`, licencia CC BY 4.0), pero los CSV devolvieron error 403 desde la conexión usada para verificar.
- **Cómo se asigna a cada entidad:** la síntesis metodológica dice que desde 2015 se usa "información sobre la localización operativa y estructura corporativa de las sociedades", según su "presencia operativa real". Unas empresas reportan el destino y, cuando no lo tienen, lo asigna la Secretaría. La serie 1999-2014 se revisó con el mismo criterio.
- **Limitaciones:**
  - Las cifras son preliminares y se actualizan cada trimestre; una actualización puede cambiar cualquier periodo desde 1999. Existen dos versiones de cada dato: "originalmente publicada" y "actualizada".
  - La asignación geográfica sigue dependiendo de lo que reporta cada empresa y del criterio de la Secretaría, así que no es una medición directa de dónde opera la inversión.
  - No se publica información por empresa.

**Advertencia para la interfaz.** El texto del planteamiento atribuye la concentración en la Ciudad de México al domicilio fiscal, lo que ya no corresponde a la metodología publicada. Propongo calcular en la fase 3 la participación real de la Ciudad de México con este archivo y redactar la advertencia sobre dos hechos comprobables: que la asignación geográfica se basa en reportes de las empresas y en el criterio de la Secretaría, y que las cifras se revisan cada trimestre.

### 4.7 IMSS, puestos de trabajo y salario base de cotización

***No verificado.***

- **Qué se esperaba:** archivos mensuales de asegurados por municipio, sector y tamaño de patrón, con masa salarial, que permitirían calcular el salario base de cotización promedio por municipio.
- **Qué pasó:** `datos.imss.gob.mx` devuelve error 403 y una verificación antibots a las descargas automatizadas y también al navegador que controlo. El portal federal `datos.gob.mx` no tiene un espejo de estos archivos.
- **Consecuencia:** no puedo confirmar columnas, años, licencia ni formato. Aunque una persona pueda descargar los archivos a mano, un pipeline que dependa de ellos no cumpliría el criterio de regenerarse con un solo comando.

### 4.8 DENUE (INEGI)

*Verificado.*

- **Qué es:** directorio de establecimientos, con actividad, rango de personal ocupado, municipio y coordenadas.
- **Nivel geográfico:** establecimiento. Se agrega a municipio y entidad con `cve_ent` y `cve_mun`.
- **Edición:** 05/2026. Es una fotografía vigente, no una serie histórica.
- **Descarga:** `https://www.inegi.org.mx/contenidos/masiva/denue/denue_{entidad}_csv.zip` (Aguascalientes: 6.8 MB, 71,871 establecimientos). También hay archivos por sector, como `denue_00_31-33_csv.zip` (58 MB).
- **Limitaciones:**
  - El personal ocupado viene como rango (`per_ocu`), no como número, así que sirve para contar establecimientos por tamaño pero no para sumar empleo.
  - Los Censos Económicos ya ofrecen unidades y empleo por estrato a los dos niveles geográficos. El DENUE solo aporta rangos de tamaño más finos y una fecha más reciente; propongo no usarlo en la v1 salvo que la capa 4 lo necesite.

### 4.9 IMMEX (INEGI)

*Verificado.*

- **Qué es:** estadística mensual y anual de los establecimientos con programa IMMEX: personal ocupado, horas, remuneraciones, ingresos del mercado nacional y extranjero, insumos importados y nacionales.
- **Nivel geográfico:** el archivo anual de manufacturas de 2024 identifica 17 entidades y agrupa el resto. El mensual añade municipios seleccionados.
- **Años:** mensual desde julio de 2007 (manufacturas) y enero de 2009 (no manufacturas), hasta agosto de 2026. Anual hasta 2024, con cifras preliminares.
- **Descarga:** `https://www.inegi.org.mx/contenidos/programas/immex/datosabiertos/conjunto_de_datos_immex_anual_manu_ent_csv.zip` (anual) y `conjunto_de_datos_immex_manu_ent_csv.zip` (mensual, un CSV por año).
- **Limitaciones:**
  - No cubre las 32 entidades por separado. Las que no aparecen deben mostrarse como "sin dato", no como cero.
  - En el CSV anual, el renglón nacional no cuadra a simple vista con los estatales. Hay que contrastarlo con el tabulado en Excel antes de usarlo.
  - Para calcular el peso del empleo IMMEX hace falta un denominador de otra fuente (personal ocupado manufacturero de los Censos Económicos), con año y concepto distintos.

### 4.10 Marco Geoestadístico (INEGI)

*Verificada la existencia y el tamaño; no descargado.*

- **Qué es:** límites de entidades y municipios en formato shapefile.
- **Edición:** diciembre de 2024, la misma que usan los Censos Económicos 2024 para sus claves.
- **Descarga:** `https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/794551132173/mg_2024_integrado.zip` (284 MB). El paquete completo con localidades y manzanas pesa 3.3 GB y no hace falta.
- **Limitaciones:** hay que simplificar las geometrías para web. Con 2,478 municipios, la decisión entre GeoJSON y PMTiles se tomará en la fase 3 midiendo el peso real.

### 4.11 Población (Censo de Población y Vivienda 2020)

*Verificada la existencia y el tamaño; no descargado.*

- **Descarga:** `https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip` (37 MB), principales resultados por localidad, agregables a municipio.
- **Limitaciones:** el dato es de 2020 y los indicadores económicos de 2023. Los municipios creados después de 2020 no aparecen.

## 5. Términos de uso

| Fuente | Términos | Obligación principal |
|---|---|---|
| INEGI (todas sus fuentes) | Términos de Libre Uso de la Información del INEGI, `https://www.inegi.org.mx/inegi/terminos.html` | Permite copiar, adaptar, extraer y explotar comercialmente. Exige dar crédito al INEGI como autor y no alterar ni suprimir los metadatos. |
| Secretaría de Economía (IED) | CC BY 4.0, según `datos.gob.mx` | Atribución. |
| IMSS | Sin verificar | Sin verificar. |

## 6. Riesgos de acceso

- **Bloqueos a descargas automatizadas.** El IMSS y el repositorio de `datos.gob.mx` rechazaron la conexión usada para verificar. No sé si el bloqueo depende de la ubicación de la conexión o afecta a cualquier script. Los archivos del INEGI y de `gob.mx` se descargaron sin problema.
- **Direcciones que cambian.** El archivo de IED cambia de dirección cada trimestre. El pipeline debe fijar la versión usada y guardar su checksum, no buscar "la última".
- **Cifras que se revisan.** IED, IMMEX y exportaciones publican datos preliminares. El catálogo debe registrar la fecha de descarga de cada fuente.

## 7. Cómo se obtuvieron los listados

Las páginas del INEGI cargan sus listados de archivos con JavaScript. Para ver qué tabulados y datos abiertos existen consulté el mismo servicio interno que usa el sitio, que no está documentado. Sirvió para descubrir los archivos; el pipeline no dependerá de él y usará solo las direcciones directas de esta página.
