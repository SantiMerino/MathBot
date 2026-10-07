"""
Genera presupuesto/MathBot_Presupuesto_SCARA.xlsx: lista de materiales del SCARA de
HowToMechatronics + cabezal de disco (versión final), con precios locales (El Salvador)
y de Amazon puestos en el país, estado de compra, registro de gastos e impresión 3D.

Uso (desde la raíz del repo):
    python presupuesto/construir_presupuesto.py
"""

from __future__ import annotations

import json
import os

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

AQUI = os.path.dirname(os.path.abspath(__file__))
import sys
SALIDA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "MathBot_Presupuesto_SCARA.xlsx")
FECHA = "06-oct-2026"

# ---------------------------------------------------------------------------
# Estilos
# ---------------------------------------------------------------------------
F = "Arial"
f_base = Font(name=F, size=10)
f_bold = Font(name=F, size=10, bold=True)
f_title = Font(name=F, size=16, bold=True, color="1F3A5F")
f_sub = Font(name=F, size=10, italic=True, color="5B6876")
f_head = Font(name=F, size=10, bold=True, color="FFFFFF")
f_input = Font(name=F, size=10, color="0000FF")
f_link = Font(name=F, size=10, color="008000")
f_url = Font(name=F, size=9, color="1F6FD1", underline="single")
f_note = Font(name=F, size=9, color="5B6876")
f_ex = Font(name=F, size=10, italic=True, color="7F8C8D")
fill_head = PatternFill("solid", fgColor="1F3A5F")
fill_input = PatternFill("solid", fgColor="FFF2CC")
fill_cat = PatternFill("solid", fgColor="E3EEFB")
fill_tot = PatternFill("solid", fgColor="D9E2EC")
fill_kpi = PatternFill("solid", fgColor="F3F5F8")
thin = Side(style="thin", color="C9D3DD")
borde = Border(left=thin, right=thin, top=thin, bottom=thin)
USD = '$#,##0.00;($#,##0.00);"-"'
USD0 = '$#,##0;($#,##0);"-"'
PCT = '0.0%;(0.0%);"-"'
wrap = Alignment(wrap_text=True, vertical="top")
center = Alignment(horizontal="center", vertical="top")

ESTADOS = ["Por comprar", "Cotizado", "Comprado", "Ya lo tenemos", "No comprar"]
FUENTES = ["Local", "Amazon"]
PRIORIDADES = ["Obligatorio", "Recomendado", "Opcional"]
CATEGORIAS = [
    "Estructura y eje Z", "Rodamientos", "Transmisión", "Motores y electrónica",
    "Cabezal de disco", "Electrónica MathBot", "Tornillería", "Impresión y varios",
]


def amz(asin: str) -> str:
    return f"https://www.amazon.com/dp/{asin}" if asin and not asin.startswith("http") else asin


# ---------------------------------------------------------------------------
# Lista de materiales. Precios por PAQUETE; unidades por paquete aparte.
#   (id, categoria, componente, especificacion, uso, origen, cantidad, prioridad,
#    tienda_local, precio_local, unid_local, verif_local,
#    precio_amazon, unid_amazon, peso_lb, fuente, asin/url, notas)
# cantidad/precio pueden ser fórmulas (str que empieza con "=").
# ---------------------------------------------------------------------------
ITEMS = [
    # Estructura y eje Z
    ("MEC-01", "Estructura y eje Z", "Varilla lisa Ø10 mm", "Acero endurecido, 300 mm (cortar)", "4 guías de la columna Z",
     "HTM", 4, "Obligatorio", "Creativo 3D (repuestos de impresoras)", 8.00, 1, "Cotizar (estimado)",
     17.99, 4, 1.8, "Amazon", "B0D2312R72",
     "HTM usa 400 mm. Con el cabezal de disco bastan 240 mm (NEMA estándar en J2) o 220 mm (NEMA corto): comprar 300 y cortar."),
    ("MEC-02", "Estructura y eje Z", "Rodamiento lineal LM10UU", "10 × 19 × 29 mm", "Plataforma Z (desliza en las varillas)",
     "HTM", 4, "Obligatorio", "Creativo 3D / CEROSA", 3.00, 1, "Cotizar (estimado)",
     7.49, 4, 0.25, "Amazon", "B0D5BHVY9W", ""),
    ("MEC-03", "Estructura y eje Z", "Husillo T8 con tuerca de latón", "Tr8×8, 300 mm (avance 8 mm/rev)", "Eje Z",
     "HTM", 1, "Obligatorio", "Creativo 3D", 15.00, 1, "Cotizar (estimado)",
     11.99, 2, 0.6, "Amazon", "B08JPPC1TZ",
     "HTM lo corta a 380 mm para varillas de 400; con varillas de 240 mm cortar a ≈225 mm. El paquete trae 2."),
    ("MEC-04", "Estructura y eje Z", "Acople flexible 5 → 8 mm", "Aluminio", "Motor Z → husillo",
     "HTM", 1, "Obligatorio", "Creativo 3D", 5.00, 1, "Cotizar (estimado)",
     9.99, 5, 0.25, "Amazon", "B07JL1QYLS", ""),
    ("MEC-05", "Estructura y eje Z", "Base de madera o MDF 18–20 mm", "≈ 30 × 25 cm", "Fijar la base del robot (12 agujeros)",
     "HTM", 1, "Recomendado", "Almacenes Vidrí", 6.00, 1, "Estimado",
     None, None, None, "Local", "", "El artículo atornilla la base a madera de 20 mm y la sujeta a la mesa con prensas."),
    # Rodamientos
    ("ROD-01", "Rodamientos", "Rodamiento axial 51108", "40 × 60 × 13 mm", "J1 (uno a cada lado de la base)",
     "HTM", 2, "Obligatorio", "CEROSA / RODASA / REPSA", 6.00, 1, "Cotizar (estimado)",
     9.99, 2, 0.45, "Amazon", "B0FDKPGXQ4", "La lista del artículo dice 1, pero el ensamble usa 2."),
    ("ROD-02", "Rodamientos", "Rodamiento axial 51107", "35 × 52 × 12 mm", "J2 y J3 (2 por junta)",
     "HTM", 4, "Obligatorio", "CEROSA / RODASA / REPSA", 5.00, 1, "Cotizar (estimado)",
     10.99, 3, 0.45, "Amazon", "https://www.amazon.com/s?k=51107+thrust+ball+bearing",
     "La lista del artículo pide 2 (solo J2); J3 usa el mismo esquema. Paquete de 3 en Amazon."),
    ("ROD-03", "Rodamientos", "Rodamiento radial 6807-2RS", "35 × 47 × 7 mm (pared delgada)", "J1",
     "HTM", 1, "Obligatorio", "CEROSA / RODASA / REPSA", 5.00, 1, "Cotizar (estimado)",
     7.29, 1, 0.1, "Local", "B07RP6RDYL", "No aparece en la lista del artículo, pero el texto lo instala primero en la base."),
    ("ROD-04", "Rodamientos", "Rodamiento radial 6806-2RS (61806)", "30 × 42 × 7 mm (pared delgada)", "J2 y J3",
     "HTM", 2, "Obligatorio", "CEROSA / RODASA / REPSA", 4.50, 1, "Cotizar (estimado)",
     13.99, 10, 0.5, "Local", "B09D33QXFL", "Amazon solo lo vende en paquete de 10."),
    ("ROD-05", "Rodamientos", "Rodamiento 608ZZ", "8 × 22 × 7 mm", "Poleas intermedias de J1 y J2 (2 c/u) + husillo",
     "HTM", 5, "Obligatorio", "CEROSA / REPSA", 1.25, 1, "Estimado (hay en el país)",
     5.19, 10, 0.35, "Local", "B0GYVYQKQ4", ""),
    # Transmisión
    ("TRA-01", "Transmisión", "Correa GT2 cerrada 200 mm", "Ancho 6 mm, paso 2 mm", "J1 etapa 1 (motor → 80 dientes)",
     "HTM", 1, "Obligatorio", "Creativo 3D", 4.00, 1, "Cotizar (estimado)",
     6.92, 5, 0.1, "Amazon", "B0FRDL4X1Z", ""),
    ("TRA-02", "Transmisión", "Correa GT2 cerrada 300 mm", "Ancho 6 mm, paso 2 mm", "J1 etapa 2 y J2 etapa 2",
     "HTM", 2, "Obligatorio", "Creativo 3D", 4.00, 1, "Cotizar (estimado)",
     8.79, 4, 0.1, "Amazon", "B0CN41SWMZ", ""),
    ("TRA-03", "Transmisión", "Correa GT2 cerrada 400 mm", "Ancho 6 mm, paso 2 mm", "J2 etapa 1 y J3",
     "HTM", 2, "Obligatorio", "Creativo 3D", 4.50, 1, "Cotizar (estimado)",
     9.21, 5, 0.1, "Amazon", "B0FRD6MX8J",
     "Las poleas GT2 (110, 92, 90, 22-80, 23-80 y 20 dientes) se imprimen: ver hoja Impresión 3D."),
    # Motores y electrónica (HTM)
    ("ELE-01", "Motores y electrónica", "Motor paso a paso NEMA 17, 40 mm", "45 N·cm, 2 A, 1.8°, 4 cables (17HS4401)", "J1, J2 y Z",
     "HTM", 3, "Obligatorio", "Electrónica 2001 (código 04-355)", 12.00, 1, f"Verificado en línea {FECHA}",
     13.99, 1, 0.75, "Local", "B00PNEQI7W",
     "Si usan el NEMA corto también en J2 (varillas de 220 mm), bajar a 2 y subir ELE-02 a 2. Confirmar que trae cable."),
    ("ELE-02", "Motores y electrónica", "Motor NEMA 17 corto (pancake)", "≈ 23 mm, 17 N·cm, 1 A", "J3 (aligera el brazo 2)",
     "HTM", 1, "Obligatorio", "Electrónica 2001 (preguntar)", None, None, "",
     10.50, 1, 0.45, "Amazon", "B0B93PNYCP",
     "El artículo usa un NEMA 17 de 24 mm en J3. Si no lo consiguen, sirve uno de 40 mm (más peso en el brazo 2)."),
    ("ELE-03", "Motores y electrónica", "CNC Shield V3 + 4 drivers A4988", "Con disipadores y jumpers", "Control de los 4 motores",
     "HTM", 1, "Obligatorio", "ArduStore SV / Casa Rivas (preguntar)", 18.00, 1, "Cotizar (estimado)",
     9.99, 1, 0.25, "Amazon", "B07TT3C3HB", "Jumpers en ¼ de paso, como en el artículo."),
    ("ELE-04", "Motores y electrónica", "Drivers A4988 de repuesto", "Paquete de 5 con disipador", "Reemplazo si se quema uno",
     "MathBot", 5, "Opcional", "", None, None, "",
     10.19, 5, 0.1, "Amazon", "B07BND65C8", ""),
    ("ELE-05", "Motores y electrónica", "Arduino UNO R3 (compatible)", "ATmega328P", "Cerebro del robot",
     "HTM", 1, "Obligatorio", "Steren (ARD-010)", 8.99, 1, f"Verificado en línea {FECHA}",
     9.49, 1, 0.15, "Local", "B0B6VV7MS7",
     "Steren la vende como 'Placa de desarrollo ARD-010': confirmar en tienda que sea compatible con UNO."),
    ("ELE-06", "Motores y electrónica", "Fuente de 12 V", "Mín. 4 A; el artículo sugiere 6 A", "Alimentación general",
     "HTM", 1, "Obligatorio", "Steren (ELI-1260, 12 V 5 A)", 25.00, 1, f"Verificado en línea {FECHA}",
     15.99, 1, 0.9, "Amazon", "B082PCR5YS",
     "Amazon: ALITOVE 12 V 6 A. Steren también tiene la ELI-F3012 (12 V 30 A, USD 27.99), que es abierta y hay que cablear a 120 V."),
    ("ELE-07", "Motores y electrónica", "Final de carrera (micro switch con palanca)", "", "Homing de J1, J2, J3 y Z",
     "HTM", 4, "Obligatorio", "Steren (SS0501A)", 0.75, 1, f"Verificado en línea {FECHA}",
     5.99, 10, 0.15, "Local", "B07X142VGC", ""),
    ("ELE-08", "Motores y electrónica", "Cables de motor de 1 m", "XH2.54 de 4 pines, paquete de 4", "Llevar los motores hasta la CNC Shield",
     "HTM", 4, "Recomendado", "", None, None, "",
     7.99, 4, 0.3, "Amazon", "B0GYP4NNBR", "Los NEMA suelen traer cable corto; J2 y J3 necesitan ≈1 m por los ejes huecos."),
    ("ELE-09", "Motores y electrónica", "Cables Dupont (80 pzs, 15 cm)", "", "Pruebas y conexiones del cabezal",
     "MathBot", 1, "Recomendado", "Steren (ARD-310)", 3.99, 1, f"Verificado en línea {FECHA}",
     None, None, None, "Local", "", ""),
    ("ELE-10", "Motores y electrónica", "Jack DC hembra + bornera de potencia", "5.5 × 2.1 mm", "Entrada de 12 V a la CNC Shield",
     "HTM", 1, "Obligatorio", "Casa Rivas", 1.50, 1, "Estimado",
     None, None, None, "Local", "", ""),
    # Cabezal de disco
    ("CAB-01", "Cabezal de disco", "Electroimán 12 V P20/15", "Ø20 × 15 mm, 2.5 kgf, ≈0.25 A", "Recoger las piezas metálicas",
     "MathBot", 1, "Obligatorio", "No se encontró en el país", None, None, "",
     6.59, 1, 0.15, "Amazon", "B078KBJNFC", ""),
    ("CAB-02", "Cabezal de disco", "Sensor inductivo LJ12A3-4-Z/BX", "M12, NPN NA, 6–36 V, detecta a 4 mm", "Detectar metal",
     "MathBot", 1, "Obligatorio", "Prestelectro / Intek (industrial)", 35.00, 1, "Estimado (USD 25–60)",
     9.99, 3, 0.35, "Amazon", "https://www.amazon.com/s?k=LJ12A3-4-Z%2FBX",
     "Paquete de 3: quedan 2 de repuesto. Uno individual (DEVMO, B07TMKTZ9L) cuesta USD 12.99."),
    ("CAB-03", "Cabezal de disco", "Micro servo SG90 / MG90S", "", "Levantar el plumón 18 mm",
     "MathBot", 1, "Obligatorio", "Casa Rivas", 4.00, 1, "Estimado (hay en el país)",
     8.88, 2, 0.15, "Local", "https://www.amazon.com/s?k=MG90S+metal+gear+2+pack", ""),
    ("CAB-04", "Cabezal de disco", "Plumón Sharpie punta fina", "Negro", "Trazar la curva paramétrica",
     "MathBot", 2, "Obligatorio", "Librería o supermercado", 1.50, 1, "Estimado",
     1.97, 2, 0.05, "Local", "B00144862U", ""),
    ("CAB-05", "Cabezal de disco", "Resorte de compresión", "Ø10–12 × 20 mm", "Porta-plumón con amortiguación",
     "MathBot", 1, "Obligatorio", "Vidrí / Freund", 0.50, 1, "Estimado",
     6.58, 1, 0.5, "Local", "B0F47T44GH", "Amazon solo vende kits de 390 resortes."),
    ("CAB-06", "Cabezal de disco", "Separador M4 × 25 mm + tuercas", "Varilla roscada o espaciador", "Colgar el electroimán del disco",
     "MathBot", 1, "Obligatorio", "Vidrí", 0.60, 1, "Estimado",
     None, None, None, "Local", "", "Las piezas impresas del cabezal están en la hoja Impresión 3D."),
    # Electrónica MathBot
    ("MB-01", "Electrónica MathBot", "MOSFET IRLZ44N + resistencias 220 Ω / 10 kΩ", "Nivel lógico", "Encender el electroimán desde A1",
     "MathBot", 1, "Obligatorio", "Casa Rivas", 1.50, 1, "Estimado (hay en el país)",
     9.49, 1, 0.1, "Local", "B088NH81S9", "Alternativa ya armada: módulo D4184 (Amazon)."),
    ("MB-02", "Electrónica MathBot", "Diodo 1N5819 o 1N4007", "", "Flyback del electroimán",
     "MathBot", 2, "Obligatorio", "Casa Rivas", 0.15, 1, "Estimado",
     7.99, 100, 0.1, "Local", "B079KG1TN2", ""),
    ("MB-03", "Electrónica MathBot", "Optoacoplador PC817 + resistencias", "", "Llevar la señal de 12 V del sensor a A2",
     "MathBot", 1, "Obligatorio", "Casa Rivas", 0.60, 1, "Estimado",
     6.99, 1, 0.1, "Local", "B0B5383L69", "Amazon: módulo armado NOYITO."),
    ("MB-04", "Electrónica MathBot", "Convertidor buck LM2596", "12 → 6 V, 3 A", "Alimentar el servo del cabezal",
     "MathBot", 1, "Obligatorio", "Casa Rivas / ArduStore SV", 4.00, 1, "Estimado",
     7.99, 5, 0.2, "Local", "B0DBVYP91F", ""),
    ("MB-05", "Electrónica MathBot", "Placa perforada 5 × 7 cm + borneras + headers", "", "Montar la interfaz sobre la base",
     "MathBot", 1, "Obligatorio", "Casa Rivas", 2.50, 1, "Estimado",
     None, None, None, "Local", "", ""),
    ("MB-06", "Electrónica MathBot", "Cable multiconductor 6–8 hilos, AWG 24", "Flexible, por metro", "Del cabezal a la base por los ejes huecos de J2 y J3",
     "MathBot", 2, "Obligatorio", "Vidrí / Casa Rivas (cable de alarma)", 0.80, 1, "Estimado",
     None, None, None, "Local", "", ""),
    # Tornillería
    ("TOR-01", "Tornillería", "Surtido de tornillos Allen M3/M4/M5 + tuercas", "", "Motores, abrazaderas, brazos y cabezal",
     "HTM", 1, "Obligatorio", "Vidrí / Freund (por pieza)", 15.00, 1, "Estimado",
     22.99, 1, 2.5, "Local", "B0FG2964F5", "El artículo trae la lista de pernos en una imagen; el surtido de Amazon cubre todo pero pesa 2.5 lb."),
    ("TOR-02", "Tornillería", "Perno M4 × 55 + tuerca de seguridad", "", "Unir la polea de J1 con el acople J1",
     "HTM", 4, "Obligatorio", "Vidrí", 0.30, 1, "Estimado",
     None, None, None, "Local", "", ""),
    ("TOR-03", "Tornillería", "Perno M8 × 45 + arandela + tuerca de seguridad", "", "Eje de las poleas intermedias",
     "HTM", 2, "Obligatorio", "Vidrí", 0.75, 1, "Estimado",
     None, None, None, "Local", "", ""),
    ("TOR-04", "Tornillería", "Perno M5 × 35 + tuercas", "", "Tensores de correa",
     "HTM", 4, "Recomendado", "Vidrí", 0.25, 1, "Estimado",
     None, None, None, "Local", "", ""),
    ("TOR-05", "Tornillería", "Tornillo M4 + tuerca", "", "Fijar la base a la madera (12 agujeros)",
     "HTM", 12, "Recomendado", "Vidrí", 0.12, 1, "Estimado",
     None, None, None, "Local", "", ""),
    # Impresión y varios
    ("VAR-01", "Impresión y varios", "Filamento PLA+ 1.75 mm", "Rollo de 1 kg", "Todas las piezas impresas (ver hoja Impresión 3D)",
     "HTM", "='Impresión 3D'!$B$6", "Obligatorio", "El Changarro (PLA 1 kg)", 27.99, 1, "Indexado en buscador (oferta)",
     11.19, 1, 2.9, "Amazon", "B07XG3RM58",
     "Avalon Tech publicaba USD 30, pero cerró su tienda en línea en jul-2026: preguntar por WhatsApp. Si la universidad imprime, poner 'Ya lo tenemos'."),
    ("VAR-02", "Impresión y varios", "Cinchos sujetacables", "Paquete corto, negro", "Ordenar los cables",
     "HTM", 1, "Recomendado", "Steren (TY24NE)", 2.49, 1, f"Verificado en línea {FECHA}",
     None, None, None, "Local", "", ""),
    ("VAR-03", "Impresión y varios", "Funda trenzada para cables 1/4\"", "", "Mazo de cables de la columna",
     "HTM", 1, "Opcional", "", None, None, "",
     9.99, 1, 0.3, "Amazon", "B07RZXSJBM", ""),
    ("VAR-04", "Impresión y varios", "Tubo termorretráctil (surtido)", "", "Aislar empalmes",
     "MathBot", 1, "Recomendado", "Casa Rivas", 2.00, 1, "Estimado",
     6.64, 1, 0.3, "Local", "B01MFA3OFA", ""),
    ("VAR-05", "Impresión y varios", "Gestión de casillero (por envío)", "", "Cargo fijo por paquete consolidado",
     "MathBot", "=EnviosCasillero", "Obligatorio", "Casillero en Miami (p. ej. QuickBox)", "=GestionEnvio", 1, "Estimado",
     None, None, None, "Local", "",
     "El flete por libra ya va dentro del 'Total Amazon puesto en SV'. Esta línea es solo la gestión; ajusten el número de envíos en Supuestos."),
]

# Estado del equipo al 06-oct-2026 (lo que ya tienen o les prestan). Ajustar aquí si regeneran el libro.
ESTADO_INICIAL = {
    "ELE-01": ("Ya lo tenemos", "Prestados."),
    "ELE-02": ("Ya lo tenemos", "Prestado: si es de 40 mm también sirve en J3 (pesa más en el brazo 2)."),
    "ELE-05": ("Ya lo tenemos", "Prestado."),
    "ELE-06": ("Ya lo tenemos", "Usarán una fuente propia: confirmar que da 12 V y al menos 4 A (mejor 5 A con electroimán y servo)."),
    "ELE-09": ("Ya lo tenemos", "Tienen jumpers de sobra."),
    "MEC-05": ("Ya lo tenemos", "La consiguen sin costo."),
    "VAR-01": ("Ya lo tenemos", "Impresión gratuita: todas las piezas impresas quedan sin costo."),
}

TIENDAS = [
    ("Electrónica 2001", "Electrónica / robótica", "NEMA 17 (USD 12, cód. 04-355), Arduino Mega, kits",
     "Calle Arce y 11 Av. Sur #635, San Salvador", "2133-2001", "electronica2001es.com", "Catálogo en línea con precios."),
    ("Steren El Salvador", "Electrónica", "Placa ARD-010, fuente 12 V 5 A, micro switches, Dupont, cinchos",
     "Paseo Gral. Escalón y 87 Av. Norte, Col. Escalón", "7876-4626 (WhatsApp)", "steren.com.sv", "Precios en línea; parte de la línea de motores aparece agotada."),
    ("Casa Rivas Electrónica", "Componentes sueltos", "MOSFET, diodos, PC817, buck, placa perforada, jack DC, servos hobby",
     "2ª Av. Norte #312 (frente a Lotería Nacional) + 3 sucursales", "2222-1718 · WhatsApp 6836-5980", "—",
     "25 % de descuento a estudiantes con carné (aplicado en la hoja)."),
    ("ArduStore SV", "Módulos Arduino", "CNC Shield, drivers A4988, LM2596", "En línea (redes sociales)", "6967-8072",
     "facebook.com/ardustore.sv", "Pedidos por mensaje directo."),
    ("Creativo 3D", "Impresión 3D y repuestos", "Varillas 10 mm, LM10UU, husillo T8, acople, correas GT2, NEMA",
     "San Salvador", "Pedidos 7718-6482 · Consultas 7235-4757", "IG @creativo3d_sv", "Reparan impresoras: la llamada que decide si se compra local."),
    ("CEROSA", "Rodamientos", "51108, 51107, 6807, 6806, 608ZZ, LM10UU", "Blvd. Venezuela #3077, San Salvador", "—", "cerosa.com",
     "Llevar las medidas; cotizar también en RODASA y REPSA."),
    ("Almacenes Vidrí", "Ferretería", "Tornillería M3–M8, madera/MDF, resortes, cable multiconductor", "Varias sucursales", "—", "vidri.com.sv",
     "Catálogo en línea; retiro en 2 h."),
    ("Prestelectro / Intek", "Sensores industriales", "Sensor inductivo (USD 25–60)", "San Salvador", "2222-1212 / 2260-8888",
     "prestelectro.com", "Solo si no quieren importar el LJ12A3."),
    ("El Changarro", "Tienda en línea", "Filamento PLA 1 kg (USD 27.99 en oferta)", "En línea", "—", "elchangarro.com.sv", "Precio indexado; confirmar."),
    ("Amazon + casillero", "Importación", "Lo que no hay en el país: electroimán, sensor, CNC Shield, rodamientos, varillas, correas",
     "Casillero en Miami (p. ej. QuickBox)", "—", "amazon.com", "≈ USD 2.50 + IVA por libra; compras < USD 300 solo pagan 13 % de IVA."),
]

SUPUESTOS = [
    ("TasaVentasEEUU", "Impuesto de venta en EE. UU. (Florida, casillero en Miami)", 0.07, PCT,
     "Amazon cobra el impuesto del estado de la dirección de entrega. Florida 6 % + condado Miami-Dade 1 %."),
    ("FleteLb", "Flete del casillero (USD por libra)", 2.50, USD,
     "QuickBox: USD 2.50 + IVA por libra o fracción, sin impuestos ni gestión (tiktok.com/@quickboxusa, 2026)."),
    ("IVA", "IVA El Salvador", 0.13, PCT, "Se cobra sobre el flete del casillero y en aduana."),
    ("RecargoCIF", "Recargo aduanal sobre el valor (flete 10 % + seguro 1.5 %)", 0.115, PCT,
     "Compras personales < USD 300: IVA 13 % sobre valor + 10 % + 1.5 % (elsalvador.com, 2026)."),
    ("LimiteFranquicia", "Límite por envío para pagar solo IVA (USD)", 300, USD0, "Por encima aplica DAI: dividir en dos envíos."),
    ("EnviosCasillero", "Número de envíos consolidados desde Amazon", 1, "0", "Todo lo de Amazon (≈USD 190) cabe en un envío bajo el límite de USD 300."),
    ("GestionEnvio", "Gestión del casillero por envío (USD)", 3.50, USD, "Estimado: varía por empresa; preguntar al abrir el casillero."),
    ("DescCasaRivas", "Descuento estudiantil Casa Rivas", 0.25, PCT, "Con carné. Se aplica solo a filas cuya tienda dice 'Casa Rivas'."),
    ("Contingencia", "Contingencia sobre lo pendiente", 0.10, PCT, "Piezas que se rompen, reimpresiones, envíos extra."),
    ("Integrantes", "Integrantes del equipo", 4, "0", "Para dividir el costo."),
    ("Presupuesto", "Presupuesto total del equipo (USD)", 300, USD0, "Editar con el monto acordado."),
    ("MermaImpresion", "Merma de impresión (pruebas, soportes, fallos)", 0.12, PCT, "Sobre los gramos estimados."),
    ("RendimientoGH", "Rendimiento de impresión (g por hora)", 11.7, "0.0", "Calibrado con las 120 h que reporta HowToMechatronics para las piezas del robot."),
    ("GramosRollo", "Gramos por rollo de filamento", 1000, "#,##0", ""),
]


def main():
    wb = Workbook()
    ws_r = wb.active
    ws_r.title = "Resumen"
    ws_b = wb.create_sheet("Lista de materiales")
    ws_g = wb.create_sheet("Registro de gastos")
    ws_i = wb.create_sheet("Impresión 3D")
    ws_s = wb.create_sheet("Supuestos")
    ws_t = wb.create_sheet("Tiendas")
    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = False

    # ----------------------------------------------------------------- Supuestos
    ws_s["A1"] = "Supuestos y parámetros"
    ws_s["A1"].font = f_title
    ws_s["A2"] = "Celdas amarillas con texto azul = editables. Todas las fórmulas del libro las usan por nombre."
    ws_s["A2"].font = f_sub
    hdr = ["Nombre", "Parámetro", "Valor", "Fuente / nota"]
    for c, h in enumerate(hdr, 1):
        cell = ws_s.cell(row=4, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
    for i, (name, desc, val, fmt, nota) in enumerate(SUPUESTOS, start=5):
        ws_s.cell(row=i, column=1, value=name).font = f_note
        ws_s.cell(row=i, column=2, value=desc).font = f_base
        c = ws_s.cell(row=i, column=3, value=val)
        c.font, c.fill, c.number_format = f_input, fill_input, fmt
        ws_s.cell(row=i, column=4, value=nota).font = f_note
        for col in range(1, 5):
            ws_s.cell(row=i, column=col).border = borde
            ws_s.cell(row=i, column=col).alignment = wrap
        wb.defined_names[name] = DefinedName(name, attr_text=f"Supuestos!$C${i}")
    r0 = 5 + len(SUPUESTOS) + 2
    ws_s.cell(row=r0, column=1, value="Integrantes del equipo").font = f_bold
    ws_s.cell(row=r0 + 1, column=1, value="Escriban sus nombres: se usan en 'Registro de gastos' y en el resumen por persona.").font = f_note
    for k in range(4):
        c = ws_s.cell(row=r0 + 2 + k, column=2, value=f"Integrante {k + 1}")
        c.font, c.fill, c.border = f_input, fill_input, borde
    miembros_rng = f"Supuestos!$B${r0 + 2}:$B${r0 + 5}"
    wb.defined_names["Miembros"] = DefinedName("Miembros", attr_text=miembros_rng)
    ws_s.cell(row=r0 + 7, column=1, value="Fórmula del costo Amazon puesto en El Salvador (por paquete)").font = f_bold
    ws_s.cell(row=r0 + 8, column=1, value=(
        "precio × (1 + impuesto EE. UU.)  +  peso lb × flete × (1 + IVA)  +  precio × (1 + recargo CIF) × IVA. "
        "No incluye DAI: mantengan cada envío bajo el límite de la franquicia.")).font = f_note
    ws_s.cell(row=r0 + 9, column=1, value=(
        "Herramientas que se asumen disponibles (no presupuestadas): cautín, multímetro, llaves Allen, sierra para metal, "
        "impresora 3D. Precios consultados el " + FECHA + ".")).font = f_note
    for col, w in zip("ABCD", (18, 52, 14, 90)):
        ws_s.column_dimensions[col].width = w

    # ----------------------------------------------------------------- Impresión 3D
    piezas = json.load(open(os.path.join(AQUI, "piezas_impresas.json"), encoding="utf-8"))
    subconj = {
        "Base": "Base", "Base cover": "Columna Z", "J1 coupler": "Columna Z", "Z-axis Bottom Plate": "Columna Z",
        "Z-axis Top Plate": "Columna Z", "Top cover": "Columna Z", "Smooth Rod Clamp": "Columna Z",
        "Z-axis Mount Platform": "Brazo 1", "Arm 1": "Brazo 1", "Arm 1 Cover": "Brazo 1", "J2 Coupler": "Brazo 2",
        "Arm 2": "Brazo 2", "Arm 2 Cover": "Brazo 2", "J3 Coupler": "Brazo 2", "Gripper to J3 connector": "Cabezal",
        "Arduino UNO case p1": "Electrónica", "Arduino UNO case p2": "Electrónica", "Wires holder": "Brazo 2",
    }
    cabezal = [
        ("Placa-disco del cabezal Ø136 × 6 mm (aligerada)", 1, 30), ("Porta-plumón con camisa deslizante (PETG)", 1, 8),
        ("Leva + soporte del micro-servo", 1, 5), ("Separador del electroimán", 1, 3), ("Abrazadera M12 del sensor", 1, 4),
    ]
    ws_i["A1"] = "Impresión 3D"
    ws_i["A1"].font = f_title
    ws_i["A2"] = ("Gramos estimados con el volumen real de cada STL: paredes y techos de 1.1 mm sólidos + 25 % de relleno, PLA 1.24 g/cm³. "
                  "Las poleas GT2 se imprimen (el artículo usa PLA normal). Las piezas de la pinza original no se imprimen.")
    ws_i["A2"].font = f_sub
    first, nfil = 13, len(piezas) + len(cabezal)
    last = first + nfil - 1
    kv = [
        ("Gramos estimados", f"=SUM(G{first}:G{last})", '#,##0" g"'),
        ("Gramos con merma", f"=B4*(1+MermaImpresion)", '#,##0" g"'),
        ("Rollos de 1 kg a comprar", "=ROUNDUP(B5/GramosRollo,0)", "0"),
        ("Horas de impresión", f"=SUM(I{first}:I{last})", '0" h"'),
        ("Avance (gramos impresos)", f'=IF(B4>0,SUMIFS(G{first}:G{last},J{first}:J{last},"Impreso")/B4,0)', PCT),
        ("Costo del filamento (USD)", "='Lista de materiales'!$T$ROWFIL", USD),
    ]
    # B4..B9 (bloque de indicadores) ; C5 se usa desde la lista de materiales
    for k, (lab, f, fmt) in enumerate(kv):
        r = 4 + k
        ws_i.cell(row=r, column=1, value=lab).font = f_bold
        c = ws_i.cell(row=r, column=2, value=f)
        c.number_format, c.font, c.fill = fmt, f_base, fill_kpi
    ws_i["C6"] = "← lo lee VAR-01 (filamento) en la lista de materiales"
    ws_i["C6"].font = f_note
    heads = ["#", "Pieza (STL)", "Subconjunto", "Cant.", "Volumen sólido (cm³)", "Gramos c/u", "Gramos total",
             "Horas c/u", "Horas total", "Estado", "Quién imprime", "Costo filamento (USD)", "Notas"]
    for c, h in enumerate(heads, 1):
        cell = ws_i.cell(row=first - 1, column=c, value=h)
        cell.font, cell.fill, cell.border, cell.alignment = f_head, fill_head, borde, Alignment(wrap_text=True, vertical="center")
    r = first
    for n, (name, q, vol, area, g, size) in enumerate(piezas, 1):
        nota = "Paramétrica de 20 dientes: una por motor (J1, J2, J3)" if "Parametric" in name else (
            "Pieza más grande (≈32 h en el artículo)" if name == "Base" else "")
        vals = [n, name, subconj.get(name, "Transmisión"), q, vol, g]
        for c, v in enumerate(vals, 1):
            ws_i.cell(row=r, column=c, value=v)
        ws_i.cell(row=r, column=13, value=nota)
        r += 1
    for k, (name, q, g) in enumerate(cabezal, start=len(piezas) + 1):
        for c, v in enumerate([k, name, "Cabezal de disco", q, None, g], 1):
            ws_i.cell(row=r, column=c, value=v)
        ws_i.cell(row=r, column=6).font = f_input
        ws_i.cell(row=r, column=6).fill = fill_input
        ws_i.cell(row=r, column=13, value="Diseño propio MathBot: gramos estimados a mano")
        r += 1
    for rr in range(first, last + 1):
        ws_i.cell(row=rr, column=7, value=f"=D{rr}*F{rr}")
        ws_i.cell(row=rr, column=8, value=f"=F{rr}/RendimientoGH")
        ws_i.cell(row=rr, column=9, value=f"=D{rr}*H{rr}")
        e = ws_i.cell(row=rr, column=10, value="Por imprimir")
        e.font, e.fill = f_input, fill_input
        ws_i.cell(row=rr, column=11).fill = fill_input
        ws_i.cell(row=rr, column=11).font = f_input
        ws_i.cell(row=rr, column=12, value=f"=IF($B$6>0,G{rr}*$B$9/($B$6*GramosRollo),0)")
        for c in range(1, 14):
            cell = ws_i.cell(row=rr, column=c)
            cell.border = borde
            if c not in (6, 10, 11):
                cell.font = f_base if c != 13 else f_note
        ws_i.cell(row=rr, column=5).number_format = "0.0"
        ws_i.cell(row=rr, column=6).number_format = "0.0"
        ws_i.cell(row=rr, column=7).number_format = "0.0"
        ws_i.cell(row=rr, column=8).number_format = "0.0"
        ws_i.cell(row=rr, column=9).number_format = "0.0"
        ws_i.cell(row=rr, column=12).number_format = USD
    tr = last + 1
    ws_i.cell(row=tr, column=2, value="Total").font = f_bold
    for c, f in ((4, f"=SUM(D{first}:D{last})"), (7, f"=SUM(G{first}:G{last})"), (9, f"=SUM(I{first}:I{last})"), (12, f"=SUM(L{first}:L{last})")):
        cell = ws_i.cell(row=tr, column=c, value=f)
        cell.font, cell.fill = f_bold, fill_tot
        cell.number_format = {4: "0", 7: "#,##0", 9: "0.0", 12: USD}[c]
    dv_imp = DataValidation(type="list", formula1='"Por imprimir,Impreso,Reimprimir"', allow_blank=True)
    ws_i.add_data_validation(dv_imp)
    dv_imp.add(f"J{first}:J{last}")
    ws_i.conditional_formatting.add(f"J{first}:J{last}", CellIsRule(operator="equal", formula=['"Impreso"'], fill=PatternFill("solid", fgColor="D5F5E3")))
    ws_i.conditional_formatting.add(f"J{first}:J{last}", CellIsRule(operator="equal", formula=['"Reimprimir"'], fill=PatternFill("solid", fgColor="FADBD8")))
    for col, w in zip("ABCDEFGHIJKLM", (5, 44, 16, 7, 12, 11, 12, 10, 11, 13, 16, 13, 48)):
        ws_i.column_dimensions[col].width = w
    ws_i.freeze_panes = f"C{first}"

    # ----------------------------------------------------------------- Lista de materiales
    ws = ws_b
    ws["A1"] = "Lista de materiales · SCARA MathBot (HowToMechatronics + cabezal de disco)"
    ws["A1"].font = f_title
    ws["A2"] = ("Editables (amarillo, texto azul): cantidad, precios, fuente elegida, estado y responsable. "
                "Negro = fórmula. Verde = viene de otra hoja. 'Total Amazon puesto en SV' incluye impuesto de EE. UU., flete del casillero e IVA de aduana (ver Supuestos). "
                f"Precios consultados el {FECHA}.")
    ws["A2"].font = f_sub
    ws.merge_cells("A2:AB2")
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[2].height = 30
    cols = ["ID", "Categoría", "Componente", "Especificación / modelo", "Uso en el robot", "Origen", "Cant.", "Prioridad",
            "Tienda local sugerida", "Precio local (USD/paq.)", "Unid./paq. local", "Precio local: verificación",
            "Precio Amazon (USD/paq.)", "Unid./paq. Amazon", "Peso paq. (lb)", "Total local (USD)",
            "Total Amazon puesto en SV (USD)", "Opción más barata", "Fuente elegida", "Costo estimado (USD)", "Estado",
            "Gastado real (USD)", "Pendiente (USD)", "Proyección (USD)", "Responsable", "Enlace Amazon",
            "Notas / fuente del precio", "Valor factura Amazon (USD)", "Opción más barata (USD)"]
    H = 4
    for c, h in enumerate(cols, 1):
        cell = ws.cell(row=H, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    ws.row_dimensions[H].height = 42
    r1 = H + 1
    rowfil = None
    for k, it in enumerate(ITEMS):
        r = r1 + k
        (iid, cat, comp, spec, uso, orig, qty, prio, tienda, pl, ul, verif, pa, ua, peso, fuente, asin, nota) = it
        if iid == "VAR-01":
            rowfil = r
        estado = "No comprar" if prio == "Opcional" else "Por comprar"
        if iid in ESTADO_INICIAL:
            estado, extra = ESTADO_INICIAL[iid]
            nota = (extra + " " + nota).strip()
        vals = {1: iid, 2: cat, 3: comp, 4: spec, 5: uso, 6: orig, 7: qty, 8: prio, 9: tienda, 10: pl, 11: ul, 12: verif,
                13: pa, 14: ua, 15: peso, 19: fuente, 21: estado, 26: amz(asin) if asin else None, 27: nota}
        for c, v in vals.items():
            ws.cell(row=r, column=c, value=v)
        ws.cell(row=r, column=16, value=(f'=IF(J{r}="","",ROUNDUP(G{r}/K{r},0)*J{r}*(1-IF(ISNUMBER(SEARCH("Casa Rivas",I{r})),DescCasaRivas,0)))'))
        ws.cell(row=r, column=17, value=(f'=IF(M{r}="","",ROUNDUP(G{r}/N{r},0)*(M{r}*(1+TasaVentasEEUU)+O{r}*FleteLb*(1+IVA)+M{r}*(1+RecargoCIF)*IVA))'))
        ws.cell(row=r, column=18, value=(f'=IF(AND(ISNUMBER(P{r}),ISNUMBER(Q{r})),IF(P{r}<=Q{r},"Local","Amazon"),'
                                         f'IF(ISNUMBER(P{r}),"Local",IF(ISNUMBER(Q{r}),"Amazon","—")))'))
        ws.cell(row=r, column=20, value=f'=IF(S{r}="Amazon",IF(ISNUMBER(Q{r}),Q{r},0),IF(ISNUMBER(P{r}),P{r},0))')
        ws.cell(row=r, column=22, value=f"=SUMIFS('Registro de gastos'!$F$10:$F$400,'Registro de gastos'!$B$10:$B$400,A{r})")
        ws.cell(row=r, column=23, value=f'=IF(OR(U{r}="Por comprar",U{r}="Cotizado"),MAX(T{r}-V{r},0),0)')
        ws.cell(row=r, column=24, value=f"=V{r}+W{r}")
        ws.cell(row=r, column=28, value=f'=IF(AND(S{r}="Amazon",ISNUMBER(M{r}),W{r}>0),ROUNDUP(G{r}/N{r},0)*M{r},0)')
        ws.cell(row=r, column=29, value=(f'=IF(AND(ISNUMBER(P{r}),ISNUMBER(Q{r})),MIN(P{r},Q{r}),'
                                         f'IF(ISNUMBER(P{r}),P{r},IF(ISNUMBER(Q{r}),Q{r},0)))'))
        for c in range(1, 30):
            cell = ws.cell(row=r, column=c)
            cell.border = borde
            cell.alignment = wrap if c in (3, 4, 5, 9, 12, 27) else Alignment(vertical="top")
            cell.font = f_base
        for c in (7, 10, 11, 13, 14, 15, 19, 21, 25):          # entradas
            ws.cell(row=r, column=c).font = f_input
            ws.cell(row=r, column=c).fill = fill_input
        for c, v in ((7, qty), (10, pl)):
            if isinstance(v, str) and v.startswith("="):
                ws.cell(row=r, column=c).font = f_link
        for c in (10, 13, 16, 17, 20, 22, 23, 24, 28, 29):
            ws.cell(row=r, column=c).number_format = USD
        ws.cell(row=r, column=15).number_format = "0.00"
        ws.cell(row=r, column=27).font = f_note
        u = ws.cell(row=r, column=26)
        if u.value:
            u.hyperlink = u.value
            u.font = f_url
        ws.cell(row=r, column=1).font = f_bold
    rN = r1 + len(ITEMS) - 1
    tot = rN + 1
    ws.cell(row=tot, column=3, value="Totales").font = f_bold
    for c in (16, 17, 20, 22, 23, 24, 28, 29):
        L = get_column_letter(c)
        cell = ws.cell(row=tot, column=c, value=f"=SUM({L}{r1}:{L}{rN})")
        cell.font, cell.fill, cell.number_format = f_bold, fill_tot, USD
    ws.cell(row=tot + 1, column=3, value="Nota: 'Total local' y 'Total Amazon' suman todas las filas aunque no se compren; el costo real del proyecto está en 'Proyección'.").font = f_note
    # validaciones
    dv_e = DataValidation(type="list", formula1='"' + ",".join(ESTADOS) + '"', allow_blank=False)
    dv_f = DataValidation(type="list", formula1='"' + ",".join(FUENTES) + '"', allow_blank=False)
    dv_p = DataValidation(type="list", formula1='"' + ",".join(PRIORIDADES) + '"', allow_blank=False)
    dv_m = DataValidation(type="list", formula1="Miembros", allow_blank=True)
    for dv, col in ((dv_e, "U"), (dv_f, "S"), (dv_p, "H"), (dv_m, "Y")):
        ws.add_data_validation(dv)
        dv.add(f"{col}{r1}:{col}{rN}")
    # formatos condicionales
    rng = f"U{r1}:U{rN}"
    for val, color in (("Comprado", "D5F5E3"), ("Ya lo tenemos", "D6EAF8"), ("Cotizado", "FCF3CF"), ("No comprar", "E5E7E9")):
        ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{val}"'], fill=PatternFill("solid", fgColor=color)))
    ws.conditional_formatting.add(f"S{r1}:S{rN}", FormulaRule(formula=[f'AND(R{r1}<>"—",S{r1}<>R{r1})'], fill=PatternFill("solid", fgColor="FDEBD0")))
    ws.conditional_formatting.add(f"A{r1}:AB{rN}", FormulaRule(formula=[f'$U{r1}="No comprar"'], font=Font(name=F, size=10, color="99A3A4")))
    ws.cell(row=tot + 2, column=3, value="Naranja en 'Fuente elegida' = hay una opción más barata. Gris = fila que no se compra (no suma).").font = f_note
    widths = {"A": 9, "B": 18, "C": 30, "D": 26, "E": 28, "F": 9, "G": 7, "H": 12, "I": 26, "J": 11, "K": 8, "L": 20,
              "M": 11, "N": 8, "O": 8, "P": 11, "Q": 13, "R": 10, "S": 10, "T": 12, "U": 13, "V": 11, "W": 11, "X": 12,
              "Y": 14, "Z": 30, "AA": 52, "AB": 12, "AC": 12}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.freeze_panes = f"D{r1}"
    ws.auto_filter.ref = f"A{H}:AC{rN}"
    # el costo del filamento en Impresión 3D apunta a VAR-01
    ws_i["B9"] = f"=IF('Lista de materiales'!$U${rowfil}=\"Ya lo tenemos\",0,'Lista de materiales'!$T${rowfil})"
    ws_i["B9"].font = f_link
    ws_i["B9"].number_format = USD
    ws_i["B9"].fill = fill_kpi

    # ----------------------------------------------------------------- Registro de gastos
    g = ws_g
    g["A1"] = "Registro de gastos"
    g["A1"].font = f_title
    g["A2"] = ("Una fila por pago. El ID enlaza con la lista de materiales: el 'Gastado real' de cada ítem y del resumen se calcula de aquí. "
               "Al terminar una compra, cambien el Estado del ítem a 'Comprado'.")
    g["A2"].font = f_sub
    g.merge_cells("A2:J2")
    g["A2"].alignment = Alignment(wrap_text=True)
    g.row_dimensions[2].height = 28
    gh = ["Fecha", "ID ítem", "Componente", "Tienda", "Cantidad", "Monto pagado (USD)", "Pagó", "Método de pago", "Comprobante", "Notas"]
    g["A4"] = "Ejemplo de cómo llenar una fila (no se suma):"
    g["A4"].font = f_bold
    ejemplo = ["06/10/2026", "ELE-01", "Motor paso a paso NEMA 17, 40 mm", "Electrónica 2001", 3, 36.00, "Integrante 1", "Tarjeta", "Factura 1234", "Pedido para retirar"]
    for c, h in enumerate(gh, 1):
        cell = g.cell(row=5, column=c, value=h)
        cell.font, cell.fill = f_bold, fill_kpi
        e = g.cell(row=6, column=c, value=ejemplo[c - 1])
        e.font = f_ex
    g.cell(row=6, column=6).number_format = USD
    for c, h in enumerate(gh, 1):
        cell = g.cell(row=9, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
    g["A8"] = "Pagos del proyecto"
    g["A8"].font = f_bold
    for rr in range(10, 401):
        g.cell(row=rr, column=3, value=(f"=IF(B{rr}=\"\",\"\",IFERROR(INDEX('Lista de materiales'!$C${r1}:$C${rN},"
                                         f"MATCH(B{rr},'Lista de materiales'!$A${r1}:$A${rN},0)),\"ID no existe\"))"))
        g.cell(row=rr, column=6).number_format = USD
        g.cell(row=rr, column=1).number_format = "dd/mm/yyyy"
        for c in range(1, 11):
            cell = g.cell(row=rr, column=c)
            if c != 3:
                cell.fill = fill_input
                cell.font = f_input
            else:
                cell.font = f_base
            if rr < 60:
                cell.border = borde
    dv_id = DataValidation(type="list", formula1=f"'Lista de materiales'!$A${r1}:$A${rN}", allow_blank=True)
    dv_mm = DataValidation(type="list", formula1="Miembros", allow_blank=True)
    dv_met = DataValidation(type="list", formula1='"Efectivo,Tarjeta,Transferencia,Otro"', allow_blank=True)
    for dv, col in ((dv_id, "B"), (dv_mm, "G"), (dv_met, "H")):
        g.add_data_validation(dv)
        dv.add(f"{col}10:{col}400")
    g["L9"] = "Total pagado"
    g["L9"].font = f_bold
    g["L10"] = "=SUM(F10:F400)"
    g["L10"].number_format = USD
    g["L10"].font = f_bold
    for col, w in zip("ABCDEFGHIJKL", (12, 10, 34, 22, 9, 14, 16, 14, 16, 30, 2, 14)):
        g.column_dimensions[col].width = w
    g.freeze_panes = "A10"

    # ----------------------------------------------------------------- Resumen
    s = ws_r
    s["A1"] = "Presupuesto · SCARA MathBot"
    s["A1"].font = Font(name=F, size=20, bold=True, color="1F3A5F")
    s["A2"] = ("SCARA de HowToMechatronics con columna Z recortada y cabezal de disco (versión final): plumón, electroimán y sensor inductivo. "
               f"Precios locales de Electrónica 2001 y Steren verificados en línea el {FECHA}; el resto, cotizar o estimado. Amazon con impuestos y casillero.")
    s["A2"].font = f_sub
    s.merge_cells("A2:H2")
    s["A2"].alignment = Alignment(wrap_text=True)
    s.row_dimensions[2].height = 30
    LB = "'Lista de materiales'"
    T_ = f"{LB}!$T${r1}:$T${rN}"
    U_ = f"{LB}!$U${r1}:$U${rN}"
    V_ = f"{LB}!$V${r1}:$V${rN}"
    W_ = f"{LB}!$W${r1}:$W${rN}"
    X_ = f"{LB}!$X${r1}:$X${rN}"
    B_ = f"{LB}!$B${r1}:$B${rN}"
    S_ = f"{LB}!$S${r1}:$S${rN}"
    Hh = f"{LB}!$H${r1}:$H${rN}"
    AB_ = f"{LB}!$AB${r1}:$AB${rN}"
    AC_ = f"{LB}!$AC${r1}:$AC${rN}"
    kpi = [
        ("Presupuesto del equipo", "=Presupuesto", USD, True),
        ("Gastado a la fecha", "='Registro de gastos'!$L$10", USD, False),
        ("Pendiente por comprar", f"=SUM({W_})", USD, False),
        ("Contingencia sobre lo pendiente", "=C7*Contingencia", USD, False),
        ("Proyección final (con contingencia)", "=C6+C7+C8", USD, False),
        ("Presupuesto restante", "=C5-C9", USD, False),
        ("Uso del presupuesto", "=IF(C5>0,C9/C5,0)", PCT, False),
        ("Costo por integrante", "=IF(Integrantes>0,C9/Integrantes,0)", USD, False),
        ("Ahorro por lo que ya tenemos", f'=SUMIFS({T_},{U_},"Ya lo tenemos")', USD, False),
        ("Pendiente si todo se compra donde sale más barato", f'=SUMIFS({AC_},{U_},"Por comprar")+SUMIFS({AC_},{U_},"Cotizado")', USD, False),
        ("Ahorro potencial (eligiendo siempre lo más barato)", "=MAX(C7-C14,0)", USD, False),
    ]
    s["A4"] = "Indicadores"
    s["A4"].font = f_bold
    for k, (lab, f, fmt, link) in enumerate(kpi):
        rr = 5 + k
        a = s.cell(row=rr, column=1, value=lab)
        a.font = f_base
        s.merge_cells(start_row=rr, start_column=1, end_row=rr, end_column=2)
        c = s.cell(row=rr, column=3, value=f)
        c.number_format = fmt
        c.font = f_link if link else Font(name=F, size=11, bold=True)
        c.fill = fill_kpi
        c.border = borde
    s["D5"] = "← editar en Supuestos"
    s["D5"].font = f_note
    s["D10"] = '=IF(C10<0,"Se pasan del presupuesto","Dentro del presupuesto")'
    s["D10"].font = f_bold
    s.conditional_formatting.add("C10", CellIsRule(operator="lessThan", formula=["0"], font=Font(name=F, size=11, bold=True, color="C0392B")))
    s.conditional_formatting.add("D10", FormulaRule(formula=["$C$10<0"], font=Font(name=F, size=10, bold=True, color="C0392B")))
    # Por categoría
    cr = 19
    s.cell(row=cr - 1, column=1, value="Por categoría").font = f_bold
    ch = ["Categoría", "Estimado", "Ya lo tenemos", "Gastado", "Pendiente", "Proyección", "% del total"]
    for c, h in enumerate(ch, 1):
        cell = s.cell(row=cr, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
    for k, cat in enumerate(CATEGORIAS):
        rr = cr + 1 + k
        s.cell(row=rr, column=1, value=cat)
        s.cell(row=rr, column=2, value=f'=SUMIFS({T_},{B_},A{rr},{U_},"<>No comprar")')
        s.cell(row=rr, column=3, value=f'=SUMIFS({T_},{B_},A{rr},{U_},"Ya lo tenemos")')
        s.cell(row=rr, column=4, value=f"=SUMIFS({V_},{B_},A{rr})")
        s.cell(row=rr, column=5, value=f"=SUMIFS({W_},{B_},A{rr})")
        s.cell(row=rr, column=6, value=f"=SUMIFS({X_},{B_},A{rr})")
        s.cell(row=rr, column=7, value=f"=IF($F${cr + 1 + len(CATEGORIAS)}>0,F{rr}/$F${cr + 1 + len(CATEGORIAS)},0)")
        for c in range(1, 8):
            cell = s.cell(row=rr, column=c)
            cell.border, cell.font = borde, f_base
            cell.number_format = PCT if c == 7 else USD
    tr = cr + 1 + len(CATEGORIAS)
    s.cell(row=tr, column=1, value="Total").font = f_bold
    for c in range(2, 8):
        L = get_column_letter(c)
        cell = s.cell(row=tr, column=c, value=f"=SUM({L}{cr + 1}:{L}{tr - 1})")
        cell.font, cell.fill, cell.border = f_bold, fill_tot, borde
        cell.number_format = PCT if c == 7 else USD
    # Por fuente y prioridad
    fr = tr + 3
    s.cell(row=fr - 1, column=1, value="Por fuente (lo que falta comprar)").font = f_bold
    for c, h in enumerate(["Fuente", "Pendiente", "Proyección"], 1):
        cell = s.cell(row=fr, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
    for k, fu in enumerate(FUENTES):
        rr = fr + 1 + k
        s.cell(row=rr, column=1, value=fu)
        s.cell(row=rr, column=2, value=f"=SUMIFS({W_},{S_},A{rr})")
        s.cell(row=rr, column=3, value=f"=SUMIFS({X_},{S_},A{rr})")
        for c in range(1, 4):
            s.cell(row=rr, column=c).border = borde
            s.cell(row=rr, column=c).number_format = USD
    ar = fr + 4
    s.cell(row=ar, column=1, value="Valor en factura Amazon por comprar (USD)")
    s.cell(row=ar, column=3, value=f"=SUM({AB_})").number_format = USD
    s.cell(row=ar + 1, column=1, value="Valor por envío (según número de envíos)")
    s.cell(row=ar + 1, column=3, value=f"=IF(EnviosCasillero>0,C{ar}/EnviosCasillero,C{ar})").number_format = USD
    s.cell(row=ar + 2, column=1, value=f'=IF(C{ar + 1}>LimiteFranquicia,"Cada envío supera USD 300: dividan la compra en más envíos para pagar solo IVA.","Cada envío queda bajo USD 300: solo pagan 13 % de IVA en aduana.")')
    s.cell(row=ar + 2, column=1).font = f_bold
    pr = fr
    s.cell(row=pr - 1, column=5, value="Por prioridad").font = f_bold
    for c, h in enumerate(["Prioridad", "Pendiente", "Proyección"], 5):
        cell = s.cell(row=pr, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
    for k, p in enumerate(PRIORIDADES):
        rr = pr + 1 + k
        s.cell(row=rr, column=5, value=p)
        s.cell(row=rr, column=6, value=f"=SUMIFS({W_},{Hh},E{rr})")
        s.cell(row=rr, column=7, value=f"=SUMIFS({X_},{Hh},E{rr})")
        for c in range(5, 8):
            s.cell(row=rr, column=c).border = borde
            s.cell(row=rr, column=c).number_format = USD
    s.cell(row=pr + 5, column=5, value="Los opcionales empiezan en 'No comprar': no suman hasta que cambien su estado.").font = f_note
    # Pagos por integrante
    mr = ar + 5
    s.cell(row=mr - 1, column=1, value="Pagado por integrante").font = f_bold
    for c, h in enumerate(["Integrante", "Pagado", "Le toca (proyección / integrantes)", "Diferencia"], 1):
        cell = s.cell(row=mr, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
        cell.alignment = Alignment(wrap_text=True)
    for k in range(4):
        rr = mr + 1 + k
        c = s.cell(row=rr, column=1, value=f"=INDEX(Miembros,{k + 1})")
        c.font = f_link
        s.cell(row=rr, column=2, value=f"=SUMIFS('Registro de gastos'!$F$10:$F$400,'Registro de gastos'!$G$10:$G$400,A{rr})")
        s.cell(row=rr, column=3, value="=$C$12")
        s.cell(row=rr, column=4, value=f"=B{rr}-C{rr}")
        for cc in range(1, 5):
            s.cell(row=rr, column=cc).border = borde
            if cc > 1:
                s.cell(row=rr, column=cc).number_format = USD
    s.cell(row=mr + 6, column=1, value="Diferencia positiva = ha puesto más de lo que le toca.").font = f_note
    # Cómo usar
    hr = mr + 9
    s.cell(row=hr, column=1, value="Cómo usarlo").font = f_bold
    pasos = [
        "1. En Supuestos: presupuesto, nombres del equipo, número de envíos del casillero.",
        "2. En Lista de materiales marquen el Estado de cada fila: 'Ya lo tenemos' (no se compra), 'Cotizado' (actualicen el precio local), 'Comprado'.",
        "3. Cambien 'Fuente elegida' a Local o Amazon; si se pinta naranja, la otra opción sale más barata.",
        "4. Cada pago va a Registro de gastos con el ID del ítem: el resumen y 'Gastado real' se actualizan solos.",
        "5. En Impresión 3D marquen las piezas impresas; los rollos de filamento a comprar salen de ahí.",
    ]
    for k, t in enumerate(pasos):
        s.cell(row=hr + 1 + k, column=1, value=t).font = f_base
    for col, w in zip("ABCDEFGH", (34, 14, 16, 16, 14, 14, 14, 4)):
        s.column_dimensions[col].width = w
    # gráfica
    ch_ = BarChart()
    ch_.type = "bar"
    ch_.style = 10
    ch_.title = "Proyección por categoría (USD)"
    ch_.y_axis.title = None
    ch_.x_axis.title = None
    data = Reference(s, min_col=6, min_row=cr, max_row=tr - 1)
    cats = Reference(s, min_col=1, min_row=cr + 1, max_row=tr - 1)
    ch_.add_data(data, titles_from_data=True)
    ch_.set_categories(cats)
    ch_.legend = None
    ch_.height, ch_.width = 7.5, 15
    s.add_chart(ch_, "I4")

    # ----------------------------------------------------------------- Tiendas
    t = ws_t
    t["A1"] = "Dónde comprar"
    t["A1"].font = f_title
    t["A2"] = "Tiendas de El Salvador y la ruta de importación. Precios verificados en línea solo donde la hoja lo indica."
    t["A2"].font = f_sub
    th = ["Tienda", "Tipo", "Qué comprar ahí", "Dirección", "Teléfono", "Web / redes", "Notas"]
    for c, h in enumerate(th, 1):
        cell = t.cell(row=4, column=c, value=h)
        cell.font, cell.fill, cell.border = f_head, fill_head, borde
    for k, row in enumerate(TIENDAS, start=5):
        for c, v in enumerate(row, 1):
            cell = t.cell(row=k, column=c, value=v)
            cell.font, cell.border, cell.alignment = f_base, borde, wrap
    for col, w in zip("ABCDEFG", (22, 20, 44, 34, 24, 24, 44)):
        t.column_dimensions[col].width = w

    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if cell.font and cell.font.name != F:
                    cell.font = Font(name=F, size=cell.font.size or 10, bold=cell.font.bold, italic=cell.font.italic,
                                     color=cell.font.color, underline=cell.font.underline)
    s.sheet_properties.tabColor = "1F3A5F"
    ws_b.sheet_properties.tabColor = "2F7BD6"
    ws_g.sheet_properties.tabColor = "1D7F5F"
    s["D14"] = "← supone que las tiendas 'Cotizar' tienen el producto al precio estimado"
    s["D14"].font = f_note
    wb.calculation.fullCalcOnLoad = True
    wb.save(SALIDA)
    print("OK", SALIDA, "filas BOM", len(ITEMS), "fila filamento", rowfil)


if __name__ == "__main__":
    main()
