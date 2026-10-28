#!/usr/bin/env python3
"""Build review-only Rocoto manual-entry workbook prototypes. No live customer data."""
from __future__ import annotations
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import json
import os
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.comments import Comment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.pagebreak import Break
from openpyxl.utils import get_column_letter

OUT = Path(os.environ.get('ROCOTO_EXPORT_REVIEW', '/tmp/rocoto-export-review'))
OUT.mkdir(parents=True, exist_ok=True)
DAY = date(2026, 8, 31)
CUTOFF = datetime(2026, 8, 31, 5, 30)
STAMP = 'EJEMPLO FICTICIO · 31/08/2026 · REVISIÓN v0.1'
INK, MUTED, GREEN, PALE, GOLD, WARN, LINE = '173C35', '62746D', '275C4C', 'EDF4EF', 'F1C56C', 'FFF2CE', 'D9E5DD'
WHITE, RED, BLUE = 'FFFFFF', '9B3F31', 'E7F0F8'
FILL = lambda color: PatternFill('solid', fgColor=color)
D = lambda x: Decimal(str(x)) if x is not None else None
QFMT, MONEY = '[$-C0A]#,##0.000;[Red]-#,##0.000;0.000', '[$-C0A]#,##0.00;[Red]-#,##0.00;0.00'
THIN = Side(style='hair', color=LINE)

PRODUCTS = {
 '00101': 'Merluza entera', '00102': 'Gamba roja', '00201': 'Tomate pera',
 '00301': 'Huevos camperos', '00302': 'Lechuga romana', '00401': 'Queso artesano',
}
CUSTOMERS = {'00012': 'Restaurante La Plaza', '00007': 'Bodega El Olivo', '00105': 'Casa del Puerto'}
STOCK = [
 ('00101','00031',24.500,'kg'), ('00101','00032',18.250,'kg'),
 ('00102','00041',12.000,'kg'),
 ('00201','00051',50.000,'kg'), ('00201','00052',22.000,'kg'), ('00201','00053',8.000,'kg'),
 ('00301','00061',180,'ud'), ('00302','00071',40,'ud'), ('00401','00081',None,'kg'),
]
# Commercial lines occur once. Lot allocations are child rows and use the final quantity's unit.
SALES = [
 dict(customer='00012',order='P-00081',doc='A-00041',line='01',product='00101',ordered=12,final=11.8,unit='kg',price=12.5,lots=[('00031',7.3),('00032',4.5)]),
 dict(customer='00012',order='P-00081',doc='A-00041',line='02',product='00201',ordered=8,final=8,unit='kg',price=1.65,lots=[('00051',8)]),
 dict(customer='00012',order='P-00081',doc='A-00041',line='03',product='00301',ordered=30,final=30,unit='ud',price=.25,lots=[('00061',30)]),
 dict(customer='00012',order='P-00082',doc='A-00042',line='01',product='00101',ordered=5,final=4.7,unit='kg',price=12.5,lots=[('00032',4.7)]),
 dict(customer='00007',order='P-00083',doc='A-00043',line='01',product='00102',ordered=3,final=None,unit='kg',price=None,lots=[]),
 dict(customer='00007',order='P-00083',doc='A-00043',line='02',product='00302',ordered=6,final=6,unit='ud',price=.8,lots=[('00071',6)]),
 dict(customer='00105',order='P-00084',doc='A-00044',line='01',product='00201',ordered=10,final=9.8,unit='kg',price=1.7,lots=[('00051',7.3),('00052',2.5)]),
 dict(customer='00105',order='P-00084',doc='A-00044',line='02',product='00301',ordered=24,final=24,unit='ud',price=.26,lots=[('00061',24)]),
]
SUPPLIERS = {'00110': 'Lonja Costa Azul', '00120': 'Huerta Río Verde', '00130': 'Granja Encina'}
RECEIPTS = [
 dict(supplier='00110',doc='0000781',line='01',time='04:45',product='00101',lot='00031',qty=24.5,unit='kg',cost=8.5),
 dict(supplier='00110',doc='0000781',line='02',time='04:45',product='00102',lot='00041',qty=12,unit='kg',cost=None),
 dict(supplier='00120',doc='0000029',line='01',time='04:50',product='00201',lot='00051',qty=50,unit='kg',cost=1.1),
 dict(supplier='00120',doc='0000029',line='01',time='04:50',product='00201',lot='00052',qty=22,unit='kg',cost=1.1),
 dict(supplier='00120',doc='0000029',line='01',time='04:50',product='00201',lot='00053',qty=8,unit='kg',cost=1.1),
 dict(supplier='00130',doc='0000048',line='01',time='05:00',product='00301',lot='00061',qty=180,unit='ud',cost=.16),
 dict(supplier='00120',doc='0000030',line='01',time='05:05',product='00302',lot='00071',qty=40,unit='ud',cost=.45),
 dict(supplier='00130',doc='0000049',line='01',time='05:10',product='00301',lot='00062',qty=None,unit='ud',cost=None),
]

def net(qty, price):
    return None if qty is None or price is None else float((D(qty)*D(price)).quantize(D('.01'), rounding=ROUND_HALF_UP))
def pending(s):
    return s['final'] is None or s['price'] is None or not s['lots']
def doc_pending(doc):
    return any(pending(s) for s in SALES if s['doc'] == doc)
def base(ws, widths, landscape=True):
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 95
    for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width = w
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.sheet_properties.outlinePr.summaryRight = False
    ws.sheet_properties.tabColor = GREEN
    ws.page_setup.orientation = 'landscape' if landscape else 'portrait'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    ws.page_margins.left = ws.page_margins.right = .25
    ws.page_margins.top = ws.page_margins.bottom = .38
    ws.print_options.horizontalCentered = True
    ws.oddFooter.left.text = 'Rocoto · Ejemplo ficticio · Revisión v0.1'
    ws.oddFooter.right.text = 'Página &P / &N'
    ws.oddFooter.left.size = ws.oddFooter.right.size = 8

def rowstyle(ws,row,start,end,fill=None,bold=False,color=INK,height=28,size=10):
    ws.row_dimensions[row].height=height
    for col in range(start,end+1):
        c=ws.cell(row,col)
        c.font=Font(name='Aptos',size=size,bold=bold,color=color)
        c.alignment=Alignment(horizontal='left',vertical='center',wrap_text=True,indent=1)
        c.border=Border(bottom=THIN)
        if fill: c.fill=FILL(fill)

def bar(ws,row,text,end,fill=INK,color=WHITE,height=30,size=11):
    ws.merge_cells(start_row=row,start_column=1,end_row=row,end_column=end)
    ws.cell(row,1,text)
    rowstyle(ws,row,1,end,fill,True,color,height,size)

def intro(ws,title,subtitle,end):
    bar(ws,1,title,end,INK,WHITE,36,18)
    bar(ws,2,STAMP,end,PALE,GREEN,23,9)
    bar(ws,3,subtitle,end,WHITE,MUTED,35,10)

def headers(ws,row,labels):
    for col,txt in enumerate(labels,1): ws.cell(row,col,txt)
    rowstyle(ws,row,1,len(labels),GREEN,True,WHITE,35,9)

def numbers(ws,row,cols,money=()):
    for col in cols:
        ws.cell(row,col).number_format=QFMT
        ws.cell(row,col).alignment=Alignment(horizontal='right',vertical='center',wrap_text=True,indent=1)
    for col in money:
        ws.cell(row,col).number_format=MONEY
        ws.cell(row,col).alignment=Alignment(horizontal='right',vertical='center',wrap_text=True,indent=1)

def textcols(ws,row,cols):
    for col in cols: ws.cell(row,col).number_format='@'

def checklist(ws,col,start,end):
    dv=DataValidation(type='list',formula1='"Pendiente,Hecho"',allow_blank=True)
    dv.error='Elige Pendiente o Hecho.';dv.errorTitle='Estado de anotación';dv.showErrorMessage=True
    dv.prompt='Marca Hecho solo después de anotarlo tú en el ERP.';dv.showInputMessage=True
    ws.add_data_validation(dv);dv.add(f'{get_column_letter(col)}{start}:{get_column_letter(col)}{end}')

def new_book():
    wb=Workbook();wb.remove(wb.active)
    wb.properties.creator='Rocoto · Prototipo de revisión'
    wb.properties.title='Rocoto · Plantillas para anotación manual'
    wb.properties.subject='Ejemplos ficticios; sin integración ni importación ERP validada'
    wb.properties.description='Las cantidades pendientes están vacías. Códigos guardados como texto.'
    return wb

def guide(wb,title,purpose,sheets,special):
    ws=wb.create_sheet('Empezar')
    base(ws,[4,27,27,27,27,4],False)
    intro(ws,title,'Para revisar la plantilla y después adaptarla a un cliente. No contiene datos reales.',6)
    r=5
    blocks=[('PARA QUÉ SIRVE',purpose),('QUÉ HOJA ABRIR',sheets),('ANTES DE COPIAR AL ERP',special),
      ('CÓMO LEERLO','Azul claro: espacio para marcar tu trabajo. Amarillo: dato pendiente; vacío NO significa cero. Los códigos 00101, 00012 y 00031 son texto y mantienen sus ceros.'),
      ('LÍMITES DEL PROTOTIPO','Todos los nombres, códigos, documentos, cantidades y precios son ficticios. No es una factura ni un formato de importación validado para Sage u otro ERP. No incluye impuestos, descuentos, devoluciones, conversión de cajas ni sincronización.'),
      ('PREGUNTAS PARA LA REVISIÓN','¿Anotas existencias a primera hora o al cierre? ¿Tu ERP descuenta stock al introducir ventas? ¿Qué códigos de artículos, clientes, proveedores y lotes utiliza? ¿Se copia desde pantalla o desde papel? ¿Quién confirma pesos y precios?')]
    for label,body in blocks:
        bar(ws,r,label,6,PALE,GREEN,25,10);r+=1
        ws.merge_cells(start_row=r,start_column=1,end_row=r,end_column=6);ws.cell(r,1,body)
        rowstyle(ws,r,1,6,WHITE,False,INK,64,10);r+=2
    ws.freeze_panes='A5';ws.print_area=f'A1:F{r-1}'
    return ws

def flat(wb,name,labels,rows,text_columns=(),quantity_columns=(),money_columns=(),date_columns=(),datetime_columns=()):
    ws=wb.create_sheet(name);base(ws,[max(12,min(26,len(x)+2)) for x in labels])
    ws.sheet_properties.tabColor=MUTED
    headers(ws,1,labels)
    for r,values in enumerate(rows,2):
        for c,v in enumerate(values,1): ws.cell(r,c,v)
        rowstyle(ws,r,1,len(labels),None,False,INK,30,10)
        textcols(ws,r,text_columns);numbers(ws,r,quantity_columns,money_columns)
        for c in date_columns: ws.cell(r,c).number_format='dd/mm/yyyy'
        for c in datetime_columns: ws.cell(r,c).number_format='dd/mm/yyyy hh:mm'
        for c,v in enumerate(values,1):
            if isinstance(v,str) and 'pendiente' in v.lower(): ws.cell(r,c).fill=FILL(WARN)
    table=Table(displayName='T'+''.join(ch for ch in name if ch.isalnum()),ref=f'A1:{get_column_letter(len(labels))}{len(rows)+1}')
    table.tableStyleInfo=TableStyleInfo(name='TableStyleMedium4',showRowStripes=True)
    ws.add_table(table);ws.auto_filter.ref=table.ref
    ws.freeze_panes='A2';ws.print_title_rows='1:1'
    ws.print_area=table.ref
    return ws

def stock_sheets(wb):
    byprod=defaultdict(list)
    for p,lot,qty,unit in STOCK: byprod[(p,unit)].append((lot,qty))
    maxlots=max(len(lots) for lots in byprod.values())
    labels=['Código artículo','Artículo','Ud']
    for i in range(1,maxlots+1): labels += [f'Lote {i}',f'Cantidad {i}']
    labels += ['Total artículo','Estado','Anotado ERP']
    width=len(labels);totalcol=width-2
    ws=wb.create_sheet('Existencias');base(ws,[13,23,7]+[12,10]*maxlots+[12,23,12])
    intro(ws,'Existencias por artículo y lote','Corte 31/08/2026 · 05:30 · Antes de ventas. Las existencias pendientes quedan vacías.',width)
    headers(ws,5,labels)
    for r,((p,unit),lots) in enumerate(byprod.items(),6):
        vals=[p,PRODUCTS[p],unit]
        for lot,qty in lots: vals += [lot,qty]
        vals += [None]*(3+maxlots*2-len(vals))
        total=None if any(q is None for _,q in lots) else float(sum(D(q) for _,q in lots))
        vals += [total,'Pendiente de contar' if total is None else 'Contado',None]
        for c,v in enumerate(vals,1): ws.cell(r,c,v)
        rowstyle(ws,r,1,width,WHITE if r%2 else PALE,height=38)
        qtycols=list(range(5,4+maxlots*2,2))+[totalcol]
        numbers(ws,r,qtycols);textcols(ws,r,[1]+list(range(4,4+maxlots*2,2)))
        if unit=='ud':
            for c in qtycols: ws.cell(r,c).number_format='[$-C0A]#,##0'
        ws.cell(r,width).fill=FILL(BLUE)
        if total is None: ws.cell(r,totalcol).fill=FILL(WARN);ws.cell(r,totalcol+1).fill=FILL(WARN)
    end=5+len(byprod);checklist(ws,width,6,end)
    ws.freeze_panes='C6';ws.auto_filter.ref=f'A5:{get_column_letter(width)}{end}'
    ws.print_title_rows='1:5';ws.print_area=f'A1:{get_column_letter(width)}{end}'
    ws['A1'].comment=Comment('Nivel de existencias, no entrada de compra. Confirmar el corte antes de teclear ventas para no descontarlas dos veces. No sumar kg con ud. Vacío no significa cero.','Rocoto')

def sales_sheets(wb):
    labels=['Cliente','Albarán','Código artículo','Artículo','Cantidad registrada','Ud','Lotes y cantidades','Precio registrado €/unidad','Precio definitivo €/unidad','Peso final (kg)','Código cliente ERP','Revisar / anotar']
    ws=wb.create_sheet('Ventas por cliente');base(ws,[25,12,13,23,12,7,30,14,14,12,14,24])
    intro(ws,'Ventas por cliente','Una línea por artículo del albarán. Lotes en la misma fila; precio definitivo para completar.',12)
    r=5;bycust=defaultdict(list)
    for sale in SALES: bycust[sale['customer']].append(sale)
    for customer,lines in bycust.items():
        if r>5: ws.row_breaks.append(Break(id=r-1))
        bar(ws,r,f'{customer} · {CUSTOMERS[customer]} · Cliente ficticio',12,INK,WHITE,28,11);r+=1
        headers(ws,r,labels);r+=1;start=r
        for sale in lines:
            lots='\n'.join(f"{lot}: {str(qty).replace('.', ',')} {sale['unit']}" for lot,qty in sale['lots']) or 'Lote y cantidad pendientes'
            vals=[CUSTOMERS[customer],sale['doc'],sale['product'],PRODUCTS[sale['product']],sale['final'],sale['unit'],lots,sale['price'],None,
                  sale['final'] if sale['unit']=='kg' else None,None,'Peso, precio y lote pendientes' if pending(sale) else None]
            for col,value in enumerate(vals,1): ws.cell(r,col,value)
            rowstyle(ws,r,1,12,WHITE if r%2 else PALE,height=max(45,len(sale['lots'])*19+10))
            numbers(ws,r,[5,10],[8,9]);textcols(ws,r,[2,3,7,11]);ws.cell(r,9).fill=FILL(BLUE)
            if sale['unit']=='ud': ws.cell(r,5).number_format='[$-C0A]#,##0'
            if pending(sale):
                for col in [5,7,8,10,12]: ws.cell(r,col).fill=FILL(WARN)
            ws.cell(r,2).comment=Comment(f"Pedido {sale['order']} · línea {sale['line']} · cantidad pedida: {sale['ordered']} {sale['unit']}. Datos ficticios.",'Rocoto')
            r+=1
        if r-start>1: ws.merge_cells(start_row=start,start_column=1,end_row=r-1,end_column=1)
        r+=1
    ws.freeze_panes='C7';ws.print_title_rows='1:3';ws.print_area=f'A1:L{r-1}'
    ws['A1'].comment=Comment('Archivo manual de demostración; no certifica importación ERP. Un importe o peso pendiente nunca es cero. Los lotes de cada fila reparten la cantidad de esa línea, sin repetirla. Confirmar códigos de cliente y artículo en destino.','Rocoto')

def control_sheet(wb):
    ws=wb.create_sheet('Control diario',1);base(ws,[7,29,65,16],False)
    intro(ws,'Mi entrada del día','Esta hoja registra la tarea manual. No conecta con el ERP ni confirma que el ERP haya guardado los datos.',4)
    headers(ws,5,['Paso','Qué revisar','Criterio de este ejemplo','Hecho por mí'])
    items=[
      ('01','Confirmar el corte','05:30, antes de ventas. No reutilizar un saldo al cierre como saldo de apertura.'),
      ('02','Confirmar el método del ERP','Validar si cada venta descuenta existencias. Aplicar simultáneamente recibos y este nivel puede duplicar entradas.'),
      ('03','Resolver existencias pendientes','00401 Queso artesano: falta recuento del lote 00081. No sustituir por cero.'),
      ('04','Anotar existencias','Desde Existencias · lectura. Guardar el corte EJ-20260831-0530 como referencia manual.'),
      ('05','Resolver ventas pendientes','Albarán A-00043: la gamba tiene 3 kg pedidos, pero cantidad final, precio y lote pendientes.'),
      ('06','Anotar pedidos por cliente','Cada pedido y albarán por separado. 00012 tiene dos pedidos: no fusionarlos.'),
      ('07','Comprobar duplicados','Buscar cada número de albarán en el ERP antes de repetir una anotación. Descargar de nuevo no crea una venta nueva.'),
      ('08','Cerrar la revisión','Anotar responsable y hora en tu procedimiento interno. Las marcas de este Excel son solo control humano.'),
    ]
    for r,(step,action,note) in enumerate(items,6):
        for c,v in enumerate([step,action,note,None],1): ws.cell(r,c,v)
        rowstyle(ws,r,1,4,WHITE if r%2 else PALE,height=58)
        textcols(ws,r,[1]);ws.cell(r,4).fill=FILL(BLUE)
    checklist(ws,4,6,13)
    bar(ws,15,'ALTERNATIVA: si anotas compras al recibirlas, usa Entradas de compra. No añadas esas mismas cantidades otra vez como nuevo stock.',4,WARN,RED,54,10)
    ws.freeze_panes='C6';ws.print_area='A1:D15'

def receipt_sheets(wb):
    ws=wb.create_sheet('Entradas · lectura');base(ws,[11,13,24,13,11,7,12,12,21,12])
    intro(ws,'Entradas de compra por documento','Cantidades RECIBIDAS, no saldo disponible. Un mismo documento puede traer varios artículos y lotes.',10)
    r=5
    bydoc=defaultdict(list)
    for x in RECEIPTS: bydoc[(x['supplier'],x['doc'])].append(x)
    labels=['Línea doc.','Código artículo','Artículo','Lote','Cantidad recibida','Ud','Coste €/unidad','Importe neto €','Estado del dato','Anotado ERP']
    for (supplier,doc),lines in bydoc.items():
        bar(ws,r,f'{supplier}  ·  {SUPPLIERS[supplier]}  ·  PROVEEDOR FICTICIO',10,INK,WHITE,27,11);r+=1
        bar(ws,r,f"Albarán proveedor {doc}  ·  31/08/2026 · {lines[0]['time']} · Movimiento de entrada",10,PALE,GREEN,26,10);r+=1
        headers(ws,r,labels);r+=1
        for x in lines:
            state='Cantidad y coste pendientes' if x['qty'] is None else 'Recibido; coste pendiente' if x['cost'] is None else 'Recepción confirmada'
            vals=[x['line'],x['product'],PRODUCTS[x['product']],x['lot'],x['qty'],x['unit'],x['cost'],net(x['qty'],x['cost']),state,None]
            for c,v in enumerate(vals,1): ws.cell(r,c,v)
            rowstyle(ws,r,1,10,WHITE if r%2 else PALE,height=38)
            numbers(ws,r,[5],[7,8]);
            if x['unit'] == 'ud': ws.cell(r,5).number_format='[$-C0A]#,##0'
            textcols(ws,r,[1,2,4]);ws.cell(r,10).fill=FILL(BLUE)
            if x['qty'] is None:
                for c in [5,7,8,9]: ws.cell(r,c).fill=FILL(WARN)
            elif x['cost'] is None:
                for c in [7,8,9]: ws.cell(r,c).fill=FILL(WARN)
            checklist(ws,10,r,r);r+=1
        r+=1
    bar(ws,r,'La cantidad recibida de 0000049 está pendiente. No se convierte en movimiento confirmado ni se incluye en el corte de existencias.',10,WARN,RED,35,9)
    bar(ws,r+1,'El lote 00032 de merluza es saldo anterior. No aparece como recepción de hoy. El stock y las entradas son objetos diferentes.',10,WHITE,MUTED,33,9)
    ws.freeze_panes='C8';ws.print_title_rows='1:3';ws.print_area=f'A1:J{r+1}'
    rows=[]
    for x in RECEIPTS:
        rows.append([DAY,x['time'],x['supplier'],SUPPLIERS[x['supplier']],x['doc'],x['line'],x['product'],PRODUCTS[x['product']],x['lot'],x['qty'],x['unit'],x['cost'],net(x['qty'],x['cost']),
          'Pendiente' if x['qty'] is None else 'Confirmada','Pendiente' if x['cost'] is None else 'Confirmado','Entrada de compra','Ejemplo ficticio'])
    flat(wb,'Entradas_planas',['fecha_recepcion','hora_recepcion','codigo_proveedor','proveedor','albaran_proveedor','linea_documento','codigo_articulo','articulo','lote','cantidad_recibida','unidad','coste_eur_unidad','importe_neto_eur','estado_cantidad','estado_coste','tipo_movimiento','origen'],rows,text_columns=[3,5,6,7,9],quantity_columns=[10],money_columns=[12,13],date_columns=[1])

FILES=[]
def save(wb,name):
    # Only working sheets leave the generator: no guide, control or duplicate raw tabs.
    keep={'Existencias','Ventas por cliente','Entradas · lectura','Clientes · lectura','Productos · lectura','Precios · lectura'}
    for ws in list(wb):
        if ws.title not in keep: wb.remove(ws)
    wb.properties.description='Ejemplo ficticio para entrada manual. Los códigos se conservan como texto; vacíos no son cero. No valida una importación ERP.'
    for ws in wb:
        if not ws['A1'].comment: ws['A1'].comment=Comment(wb.properties.description,'Rocoto')
    path=OUT/name;wb.save(path);FILES.append(path)

wb=new_book();guide(wb,'01 · Existencias por lote','Para quien anota los niveles de stock de una vez. El mismo artículo puede tener uno o varios lotes.','Existencias · lectura: una fila por artículo y parejas lote / cantidad. Stock_plano: una fila por artículo, lote y unidad, con filtro.',
  'Este ejemplo representa stock contado a las 05:30, ANTES de las ventas. Si tu corte es después de las ventas, no vuelvas a descontarlas sin validar el método. Una existencia no es un albarán de compra.');stock_sheets(wb);save(wb,'01-existencias-por-lote.xlsx')
wb=new_book();guide(wb,'02 · Ventas por cliente','Para copiar ventas al ERP cliente por cliente, conservando cada pedido y albarán.','Ventas · por cliente: bloques de lectura. Ventas_planas: una línea comercial por fila. Lotes_ventas: reparto de esa línea entre lotes, sin duplicar importes.',
  'En A-00043 la gamba tiene peso, precio y lote pendientes. No confundas pedido con cantidad final. Un importe vacío no es un regalo. Los importes son netos sin impuestos, descuentos o portes.');sales_sheets(wb);save(wb,'02-ventas-por-cliente.xlsx')
wb=new_book();guide(wb,'03 · Entrada diaria · stock + ventas','Para quien hace una sola tarea al día: anotar primero un corte de stock y después los pedidos de cada cliente.','Control diario: secuencia y comprobaciones. Existencias y ventas: las mismas plantillas 01 y 02, reunidas. Las hojas planas son auxiliares, no importadores.',
  'Método propuesto solo para revisar: corte previo a ventas (05:30). Confirmar cómo descuenta stock ese ERP. Si ya has introducido las recepciones, no sumes el mismo género otra vez.');control_sheet(wb);stock_sheets(wb);sales_sheets(wb);save(wb,'03-entrada-diaria-stock-y-ventas.xlsx')
wb=new_book();guide(wb,'04 · Entradas de compra','Para quien registra cada recepción de proveedor cuando llega. Conserva documento, línea, artículo, lote y cantidad recibida.','Entradas · lectura: bloques por proveedor y documento. Entradas_planas: una fila por documento, línea y lote; cada cantidad pertenece únicamente a ese lote.',
  'Es un movimiento de entrada, no un nivel de existencias. La recepción 0000049 no tiene cantidad confirmada. El coste de gamba falta: no inventar cero. No equivale a una integración de inventario en tiempo real.');receipt_sheets(wb);save(wb,'04-entradas-de-compra.xlsx')


# Master-data prototypes: explicit fixture mapping, independently identified product variants.
CUSTOMER_BOOK = [
 dict(id='cli-ej-001',erp='00012',name='Restaurante La Plaza',site='Sede única',tier='T-01',tier_name='Hostelería',zone='Centro',channel='WhatsApp'),
 dict(id='cli-ej-002',erp='00007',name='Bodega El Olivo',site='Sede única',tier='T-01',tier_name='Hostelería',zone='Norte',channel='Teléfono'),
 dict(id='cli-ej-003',erp='00105',name='Casa del Puerto',site='Sede puerto',tier='T-02',tier_name='Volumen',zone='Costa',channel='WhatsApp'),
 dict(id='cli-ej-004',erp=None,name='Casa del Puerto',site='Sede mercado',tier='T-01',tier_name='Hostelería',zone='Centro',channel='Email'),
]
PRODUCT_BOOK = [
 dict(id='prd-ej-001',sku='00101',name='Merluza entera',unit='kg',pack='caja',factor=6.5,conversion='Aproximada',base=None,variant='Entera',variable=True),
 dict(id='prd-ej-011',sku='00111',name='Merluza · filetes',unit='kg',pack='bandeja',factor=None,conversion='Pendiente',base='00101',variant='Filetes',variable=True),
 dict(id='prd-ej-002',sku='00102',name='Gamba roja',unit='kg',pack='caja',factor=2,conversion='Declarada exacta',base=None,variant=None,variable=True),
 dict(id='prd-ej-003',sku='00201',name='Tomate pera',unit='kg',pack='caja',factor=6,conversion='Declarada exacta',base=None,variant=None,variable=True),
 dict(id='prd-ej-004',sku='00301',name='Huevos camperos',unit='ud',pack='docena',factor=12,conversion='Declarada exacta',base=None,variant='M',variable=False),
 dict(id='prd-ej-014',sku='00311',name='Huevos camperos · L',unit='ud',pack='docena',factor=12,conversion='Declarada exacta',base='00301',variant='L',variable=False),
 dict(id='prd-ej-005',sku='00302',name='Lechuga romana',unit='ud',pack='caja',factor=10,conversion='Declarada exacta',base=None,variant=None,variable=False),
 dict(id='prd-ej-006',sku='00401',name='Queso artesano',unit='kg',pack='pieza',factor=None,conversion='Pendiente',base=None,variant=None,variable=True),
 dict(id='prd-ej-099',sku=None,name='Pimiento rojo · alta pendiente',unit='kg',pack=None,factor=None,conversion='Sin envase definido',base=None,variant=None,variable=True),
]
TARIFF_BOOK = [('T-01','Hostelería'),('T-02','Volumen')]
PRICE_BOOK = []
price_values = {
 'T-01': {'00101':12.5,'00111':16.75,'00102':68,'00201':1.65,'00301':.25,'00311':.31,'00302':.8,'00401':None},
 'T-02': {'00101':11.75,'00111':None,'00102':64,'00201':1.55,'00301':.24,'00311':.29,'00302':.75,'00401':None},
}
for tier,tier_name in TARIFF_BOOK:
    for p in PRODUCT_BOOK:
        if not p['sku']: continue
        value=price_values[tier][p['sku']]
        PRICE_BOOK.append(dict(product=p['id'],sku=p['sku'],name=p['name'],tier=tier,tier_name=tier_name,price=value,unit=p['unit'],currency='EUR',
          valid_from=(date(2026,8,28) if p['unit']=='ud' else DAY) if value is not None else None,valid_to=None,
          validity_source='Vigencia declarada en ejemplo' if value is not None else 'Sin precio en fuente',source='TARIFA-EJ-20260831',snapshot=DAY))

def customer_sheets(wb):
    ws=wb.create_sheet('Clientes · lectura');base(ws,[17,15,28,20,17,13,13,22])
    intro(ws,'Clientes · cuentas y códigos','ID de Rocoto y código ERP son distintos. Los códigos ERP de esta muestra son ficticios y no están validados.',8)
    headers(ws,5,['ID Rocoto','Código ERP (ejemplo)','Nombre del cliente','Sede / referencia','Tarifa','Zona','Canal','Estado mapeo ERP'])
    for r,c in enumerate(CUSTOMER_BOOK,6):
        vals=[c['id'],c['erp'],c['name'],c['site'],c['tier_name'],c['zone'],c['channel'],'Pendiente de código' if c['erp'] is None else 'Ejemplo · no validado']
        for col,v in enumerate(vals,1): ws.cell(r,col,v)
        rowstyle(ws,r,1,8,WHITE if r%2 else PALE,height=46);textcols(ws,r,[1,2])
        if c['erp'] is None:
            ws.cell(r,2).fill=FILL(WARN);ws.cell(r,8).fill=FILL(WARN)
    bar(ws,11,'Casa del Puerto aparece dos veces: dos ID de Rocoto, dos sedes y dos cuentas. No fusionar por nombre.',8,WARN,RED,35,10)
    bar(ws,12,'Antes de transcribir, confirmar el código que identifica a cada cuenta en el ERP. Un ID de Rocoto no sustituye ese código.',8,WHITE,MUTED,35,10)
    ws.freeze_panes='C6';ws.auto_filter.ref='A5:H9';ws.print_title_rows='1:5';ws.print_area='A1:H12'
    rows=[[c['id'],c['erp'],c['name'],c['site'],c['tier'],c['tier_name'],c['zone'],c['channel'],None,None,
           'Pendiente de código' if c['erp'] is None else 'Ejemplo ficticio no validado','Ejemplo ficticio'] for c in CUSTOMER_BOOK]
    flat(wb,'Clientes_planos',['id_rocoto','codigo_cliente_erp','cliente','sede_referencia','id_tarifa','tarifa','zona','canal','telefono','email','estado_mapeo_erp','origen'],rows,text_columns=[1,2,5,9,10])

def product_sheets(wb):
    ws=wb.create_sheet('Productos · lectura');base(ws,[12,27,8,11,11,22,12,15,13])
    intro(ws,'Productos · artículos y variantes','Cada SKU es un artículo independiente. El factor de envase se declara con su estado; nunca se usa como peso final medido.',9)
    headers(ws,5,['Código SKU','Artículo','Ud venta','Envase','Ud / envase','Estado conversión','SKU base','Variante','Peso variable'])
    for r,p in enumerate(PRODUCT_BOOK,6):
        vals=[p['sku'],p['name'],p['unit'],p['pack'],p['factor'],p['conversion'],p['base'],p['variant'],'Sí' if p['variable'] else 'No']
        for col,v in enumerate(vals,1): ws.cell(r,col,v)
        rowstyle(ws,r,1,9,WHITE if r%2 else PALE,height=42);textcols(ws,r,[1,7]);numbers(ws,r,[5])
        if p['unit']=='ud': ws.cell(r,5).number_format='[$-C0A]#,##0'
        if p['conversion'] in ['Aproximada','Pendiente']:
            ws.cell(r,5).fill=FILL(WARN);ws.cell(r,6).fill=FILL(WARN)
        if p['sku'] is None: ws.cell(r,1).fill=FILL(WARN)
    bar(ws,16,'1 caja de merluza ≈ 6,5 kg es una referencia de envase. No confirma el peso de lo preparado ni autoriza una conversión exacta.',9,WARN,RED,36,10)
    bar(ws,17,'00111 y 00311 conservan su SKU propio. Relacionarlos con un SKU base no fusiona su stock, sus ventas ni sus precios.',9,WHITE,MUTED,33,10)
    ws.freeze_panes='C6';ws.auto_filter.ref='A5:I14';ws.print_title_rows='1:5';ws.print_area='A1:I17'
    rows=[[p['id'],p['sku'],p['name'],p['unit'],p['pack'],p['factor'],p['unit'] if p['pack'] else None,p['conversion'],
        p['base'],p['variant'],'Sí' if p['variable'] else 'No','Pendiente de SKU' if p['sku'] is None else 'SKU ficticio','Ejemplo ficticio'] for p in PRODUCT_BOOK]
    flat(wb,'Productos_planos',['id_rocoto','codigo_sku','articulo','unidad_venta','envase','unidades_por_envase','unidad_factor','estado_conversion','sku_base','variante','peso_variable','estado_codigo','origen'],rows,text_columns=[1,2,9],quantity_columns=[6])

def price_sheets(wb):
    ws=wb.create_sheet('Precios · lectura');base(ws,[12,27,16,13,10,10,15,15,26])
    intro(ws,'Precios por tarifa','Una fila por SKU + tarifa. Precio neto por la unidad indicada. La vigencia procede de la fuente, no de la fecha de descarga.',9)
    r=5
    for tier,tier_name in TARIFF_BOOK:
        if r>5: ws.row_breaks.append(Break(id=r-1))
        bar(ws,r,f'{tier} · {tier_name} · TARIFA FICTICIA',9,INK,WHITE,28,11);r+=1
        headers(ws,r,['Código SKU','Artículo','Tarifa','Precio neto','Unidad precio','Moneda','Válido desde','Válido hasta','Estado / vigencia']);r+=1
        for p in [x for x in PRICE_BOOK if x['tier']==tier]:
            vals=[p['sku'],p['name'],p['tier_name'],p['price'],f"€/{p['unit']}",p['currency'],p['valid_from'],p['valid_to'],
              'Pendiente de precio' if p['price'] is None else 'Fecha inicial declarada; sin fin declarado']
            for col,v in enumerate(vals,1): ws.cell(r,col,v)
            rowstyle(ws,r,1,9,WHITE if r%2 else PALE,height=42);textcols(ws,r,[1]);numbers(ws,r,[],[4])
            for col in [7,8]: ws.cell(r,col).number_format='dd/mm/yyyy'
            if p['price'] is None:
                for col in [4,7,8,9]: ws.cell(r,col).fill=FILL(WARN)
            r+=1
        bar(ws,r,'Origen: TARIFA-EJ-20260831 · Fecha de consulta: 31/08/2026. «Válido hasta» vacío significa que la fuente no indica fin.',9,PALE,GREEN,33,9);r+=1
        bar(ws,r,'Un precio pendiente no es 0 ni hereda automáticamente el precio del SKU base. Esta hoja no analiza costes ni márgenes.',9,WARN,RED,33,9);r+=2
    ws.freeze_panes='C7';ws.print_title_rows='1:3';ws.print_area=f'A1:I{r-1}'
    rows=[[p['product'],p['sku'],p['name'],p['tier'],p['tier_name'],p['price'],p['unit'],p['currency'],p['valid_from'],p['valid_to'],
           p['validity_source'],p['source'],p['snapshot'],'Pendiente' if p['price'] is None else 'Configurado en ejemplo','Ejemplo ficticio'] for p in PRICE_BOOK]
    flat(wb,'Precios_planos',['id_producto_rocoto','codigo_sku','articulo','id_tarifa','tarifa','precio_neto','unidad_precio','moneda','vigente_desde','vigente_hasta','fuente_vigencia','referencia_fuente','fecha_consulta','estado_precio','origen'],rows,text_columns=[1,2,4],money_columns=[6],date_columns=[9,10,13])

wb=new_book();g=guide(wb,'05 · Clientes','Para revisar el listado de cuentas y los códigos que se usarían al anotarlas en el ERP.','Clientes · lectura: identificación de cada cuenta. Clientes_planos: una fila por ID Rocoto, sin fusionar nombres parecidos.',
  'El ID Rocoto y el código ERP se conservan por separado. Los códigos ERP visibles son ficticios; uno está pendiente. No deducir un código contable a partir del nombre.');g['A21']='¿Cuál es el código real de cada cuenta en el ERP? ¿Se distinguen sucursales? ¿Qué tarifa corresponde? ¿Qué contactos deben incluirse con autorización?';customer_sheets(wb);save(wb,'05-clientes.xlsx')
wb=new_book();g=guide(wb,'06 · Productos','Para revisar artículos, códigos, unidades, envases y variantes antes de copiar un catálogo o preparar un mapeo.','Productos · lectura: una fila por SKU. Productos_planos: incluye ID Rocoto, SKU y datos explícitos del factor de envase.',
  'La conversión de merluza es aproximada; las conversiones desconocidas están vacías. Las variantes 00111 y 00311 son artículos propios. Un SKU base es una relación, no un permiso para fusionarlos.');g['A18']='Todos los datos son ficticios. Los factores de envase son información del catálogo; este archivo no convierte cantidades de un pedido ni mide su peso. No incluye integración ERP, stock por ubicación, imágenes ni historia de cambios.';g['A21']='¿Cada variante tiene SKU propio? ¿El envase tiene factor exacto o nominal? ¿Cuándo se mide el peso? ¿Qué unidad registra el ERP? ¿Puede faltar el código hasta completar el alta?';product_sheets(wb);save(wb,'06-productos.xlsx')
wb=new_book();g=guide(wb,'07 · Precios por tarifa','Para revisar qué precio corresponde a cada SKU y tarifa en una fecha. Cada fila conserva su unidad y moneda.','Precios · lectura: agrupada por tarifa. Precios_planos: una fila por SKU + tarifa, con estado del precio y origen de la vigencia.',
  'La fecha de consulta no sustituye a la vigencia de la fuente. Una fecha final vacía no afirma vigencia perpetua. Los precios pendientes se dejan vacíos; no se calculan márgenes en esta plantilla.');g['A18']='Todos los precios son ficticios y netos sin impuestos, descuentos ni portes. Es una instantánea de tarifas, no un análisis de margen ni un historial de ventas. No valida una importación ERP ni resuelve tarifas particulares de clientes.';g['A21']='¿Qué tarifas se exportan? ¿El precio es por kg, unidad o envase? ¿Qué fecha de inicio y fin declara la fuente? ¿Hay precios particulares por cliente? ¿Los pendientes se revisan aparte?';price_sheets(wb);save(wb,'07-precios-por-tarifa.xlsx')

# Validate facts and file structure, including the exact values after an Excel round-trip.
checks=[]
commercial_keys=[(s['doc'],s['line']) for s in SALES]
assert len(commercial_keys)==len(set(commercial_keys))
for s in SALES:
    if s['lots']:
        assert sum(D(q) for _,q in s['lots'])==D(s['final']), s
        for lot,qty in s['lots']:
            matches=[a for a in STOCK if a[0]==s['product'] and a[1]==lot and a[3]==s['unit']]
            assert len(matches)==1
    else:
        assert s['final'] is None
consumed=defaultdict(Decimal)
for s in SALES:
    for lot,qty in s['lots']: consumed[(s['product'],lot,s['unit'])]+=D(qty)
for p,lot,qty,unit in STOCK:
    if qty is not None: assert consumed[(p,lot,unit)]<=D(qty)
assert len({s['doc'] for s in SALES if s['customer']=='00012'})==2
checks += ['Commercial (albaran,line) keys unique: 8 lines / 4 orders.', 'Every confirmed sales line equals sum of allocated lots; same unit as stock.', 'Confirmed lot allocations do not exceed opening stock.', 'Customer 00012 retains two distinct orders / delivery notes.', 'Pending quantity/price never replaced by zero.']
for path in FILES:
    rb=load_workbook(path)
    expected=2 if path.name.startswith('03-') else 1
    assert len(rb.sheetnames)==expected, (path.name,rb.sheetnames)
    assert all(not any(term in name for term in ['Empezar','plano','Lotes_ventas','Control']) for name in rb.sheetnames)
    for ws in rb:
        assert ws.freeze_panes and ws['A2'].value==STAMP
        assert ws['A1'].comment
    if 'Existencias' in rb:
        ws=rb['Existencias'];assert ws['A6'].value=='00101' and ws['A6'].data_type=='s'
        assert ws['D6'].value=='00031' and ws['F6'].value=='00032'
        assert ws['H8'].value=='00053' and ws['I8'].value==8
        assert ws['J11'].value is None
    if 'Ventas por cliente' in rb:
        ws=rb['Ventas por cliente']
        data=[row for row in ws.iter_rows() if row[2].value in PRODUCTS]
        assert len(data)==len(SALES)
        assert all(row[8].value is None and row[10].value is None for row in data)
        assert data[0][2].value=='00101' and data[0][2].data_type=='s'
        assert data[0][6].value=='00031: 7,3 kg\n00032: 4,5 kg'
        assert data[0][4].value==11.8 and data[0][7].value==12.5
        assert data[4][4].value is None and data[4][7].value is None
        assert len({row[1].value for row in data})==4
    if 'Clientes · lectura' in rb:
        ws=rb['Clientes · lectura'];assert ws['B6'].value=='00012' and ws['B6'].data_type=='s'
        assert ws['B9'].value is None
        assert ws['C8'].value==ws['C9'].value and ws['A8'].value!=ws['A9'].value
    if 'Productos · lectura' in rb:
        ws=rb['Productos · lectura'];assert ws['A6'].value=='00101' and ws['E6'].value==6.5
        assert ws['F6'].value=='Aproximada' and ws['A7'].value=='00111' and ws['G7'].value=='00101'
        assert ws['E7'].value is None and ws['A14'].value is None
    if 'Precios · lectura' in rb:
        ws=rb['Precios · lectura'];data=[row for row in ws.iter_rows() if row[0].value in price_values['T-01']]
        assert len(data)==16
        assert len({(row[0].value,row[2].value) for row in data})==16
        assert sum(row[3].value is None for row in data)==3
        assert all(row[7].value is None for row in data)
    checks.append(f'{path.name}: reopened; {expected} working sheet(s), codes/nulls and compact layout passed.')

# Exact copies for optional print rendering; no hidden sheets or alternate data exports.
render=Path(os.environ.get('ROCOTO_EXPORT_RENDER','/tmp/rocoto-export-review-human/print'));render.mkdir(parents=True,exist_ok=True)
for path in FILES: load_workbook(path).save(render/path.name)

manifest={
 'prototype_version':'0.2-human-only','fictitious':True,'date':'2026-08-31','stock_cutoff':'05:30, before sales',
 'files':[{ 'filename':p.name,'sheets':load_workbook(p,read_only=True).sheetnames,'bytes':p.stat().st_size} for p in FILES],
 'counts':{'stock_product_lot_rows':len(STOCK),'commercial_sale_lines':len(SALES),'sale_lot_rows':sum(len(s['lots']) for s in SALES),'receipt_lot_rows':len(RECEIPTS),'customer_rows':len(CUSTOMER_BOOK),'product_rows':len(PRODUCT_BOOK),'sku_tariff_rows':len(PRICE_BOOK)},
 'checks':checks,
 'known_pending':{'stock':'00401 / lote 00081 quantity absent','sales':'A-00043 line 01 final quantity, price, allocation absent','receipts':'0000049 quantity absent; 0000781 line 02 cost absent','customers':'cli-ej-004 ERP code absent; all other mapping codes fictitious/unvalidated','products':'00111 and 00401 pack factor absent; prd-ej-099 SKU absent','prices':'T-02 / 00111 and both 00401 prices absent; source end dates absent'},
}
(OUT/'validation.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
