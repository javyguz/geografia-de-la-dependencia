# Contenido editable

## Recorrido (`tour.json`)

Cada paso del recorrido tiene cuatro campos:

| Campo   | Qué es                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` | El título del paso.                                                                                                                                                                    |
| `text`  | El párrafo. Separa párrafos con `\n\n`.                                                                                                                                                |
| `view`  | Lo que muestra el mapa: la parte de la dirección de la página que empieza en `?`. Deja el mapa como quieras, copia la dirección y pega desde el `?`. Vacío (`""`) es la vista inicial. |
| `draft` | `true` mientras el texto sea provisional; la app lo marca como tal. Ponlo en `false` al escribir el texto final.                                                                       |

Conviene no escribir cifras en el texto: cambian cuando se actualizan los datos y quedarían sin unidad, año ni fuente. Si el paso selecciona un territorio (`t=` en la vista), el recorrido muestra su valor con todo eso debajo del texto.

`pnpm test` comprueba que cada vista apunta a una capa, un indicador, un sector y un territorio que existen.
