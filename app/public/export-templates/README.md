# Rocoto · Archivos para entrada manual

This download pack preserves the August 2026 fictional review examples and research snapshot.
The maintained generator is [app/tools/generate-export-review.py](../../../docs/omitted-sources.md);
run it from `app/` as described in [the app README](../../../docs/omitted-sources.md).
Current output contracts are indexed in [the product documentation](../../../docs/omitted-sources.md);
the bundled `THE-EXPORT-CANON.md` preserves the earlier review snapshot.

**Siete ejemplos ficticios. Revisión de la estructura: una hoja útil por archivo; stock + ventas tiene dos.**

| Archivo | Hojas | Qué contiene |
|---|---:|---|
| `01-existencias-por-lote.xlsx` | 1 | Un artículo por fila; todas las parejas lote / cantidad y total conocido. |
| `02-ventas-por-cliente.xlsx` | 1 | Clientes agrupados; artículo, albarán, cantidad, unidad, precio registrado, precio definitivo para completar, peso final conocido y todos los lotes en la misma fila. |
| `03-entrada-diaria-stock-y-ventas.xlsx` | 2 | Existencias y ventas por cliente, sin hojas adicionales de instrucciones. |
| `04-entradas-de-compra.xlsx` | 1 | Proveedor, documento, artículo, lote y cantidad recibida. |
| `05-clientes.xlsx` | 1 | Cuentas identificadas por separado; código ERP ficticio o pendiente, tarifa y contacto de origen. |
| `06-productos.xlsx` | 1 | SKU, unidad, envase, factor conocido o aproximado y variantes independientes. |
| `07-precios-por-tarifa.xlsx` | 1 | Cada SKU y tarifa con precio, unidad, moneda y vigencia declarada. |

No hay pestañas «Leer primero», «Empezar», tablas planas duplicadas ni una segunda lista de lotes de venta. La advertencia breve está arriba; las notas de las celdas conservan el contexto que hace falta revisar. Los encabezados quedan congelados y las listas sencillas mantienen filtros.

## Leer y copiar

- **Lotes:** una línea de 11,8 kg conserva `00031: 7,3 kg` y `00032: 4,5 kg` en su misma celda. No se duplica la cantidad comercial ni el precio por cada lote.
- **Precio:** el registrado sirve de referencia; «Precio definitivo» queda vacío para completarlo. Una tarifa no confirma por sí sola el precio final de una venta.
- **Peso:** solo aparece cuando el ejemplo lo conoce. Una cantidad pedida o un factor nominal de caja nunca sustituye al peso medido.
- **Pendientes:** una celda vacía no es cero. La gamba de A-00043 conserva sus datos finales pendientes; el queso no tiene un recuento confirmado.
- **Códigos:** `00101`, `00012` y los lotes conservan los ceros iniciales como texto. El ID Rocoto y el código de la cuenta en el ERP son referencias distintas.
- **Clientes y variantes:** nombres iguales no fusionan cuentas. Una variante conserva su SKU propio; no hereda silenciosamente el stock o el precio del artículo base.

## Stock y compras

El stock es un nivel en un momento; una compra es una entrada. El corte de este ejemplo es a las 05:30, antes de las ventas. Si se introduce un stock de cierre y después las mismas ventas vuelven a descontarse, la salida se duplicaría. Confirmar ese método con quien lleva el ERP antes de copiar.

En la descarga dinámica, cuando un producto tiene movimientos en unidades distintas, su total queda vacío y los movimientos originales se conservan en una columna de esa misma hoja. No se suman kilos y cajas ni se añade otra pestaña para revisarlos.

## Alcance

Todo es ficticio y se usa para revisar la presentación. Estos archivos no certifican una importación en Sage ni otro ERP y no conectan, envían correos o modifican inventario. No incluyen impuestos, descuentos, portes ni conversión automática de unidades. Los precios por tarifa son configuración, no análisis de costes o márgenes. Las fechas desconocidas quedan vacías; la consulta no inventa una vigencia.

Las cantidades y precios exportados son valores, no una aplicación de pedidos con recálculo automático dentro de Excel. Revisar los totales si se modifica una muestra.

Los PDF y PNG muestran estas mismas hojas de trabajo. `rocoto-plantillas-excel-v01.zip` se mantiene como enlace estable y contiene las versiones actualizadas. `validation.json` registra las siete aperturas, sus hojas, los códigos, los pendientes y los lotes.

Generador: `tools/generate-export-review.py`. La variable `ROCOTO_EXPORT_REVIEW` elige la carpeta de salida; los archivos temporales de impresión quedan fuera de la carpeta pública.
