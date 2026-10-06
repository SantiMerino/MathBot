# Prompts finales

## Ajuste de la segunda lámina: torreta y numeración

Edit this existing MathBot EEZY technical proposal sheet. Preserve the pencil/blue/orange style, title, main EEZY robot body and linkage, reference dimensions, overall layout, sensor pair, and 3-petal curve. Correct the turret depiction and replace the corrupted bottom BOM strip. This is a mechanical-clarity correction, not a redesign.
1. In both main robot's head and enlarged operational head, render a drum rotating on a HORIZONTAL axle, with exactly THREE tool cartridges attached RADIALLY 120 degrees apart in the same rotational plane. The active pen cartridge projects straight DOWN from the bottom radial face. The magnet cartridge projects UP-LEFT from another radial face with its pole face pointing up-left. The gripper cartridge projects UP-RIGHT from the third radial face with jaws pointing up-right. Thus only the pen can touch the paper; the tools are not all hanging parallel vertically. Draw radial support mounts explicitly. Keep fixed two-sensor bracket on stationary outer yoke pointing down, separated from rotating envelope. Horizontal-axis motor drive and bearings connect to side of drum, not a top vertical spindle. Exploded detail corresponds to this same architecture, with three cartridges shown around drum radially using dashed assembly arrows, not stacked inline on shaft. Tool pose clarity is the most important visual change.
2. Replace entire bottom illustrated BOM strip with a CLEAN LEGIBLE TABLE of 20 exact rows split into 2 column groups (01–10 left, 11–20 right). No duplicate IDs. Table contents verbatim:
01 Tablero y base fija | 1 conj.
02 Plataforma giratoria J1 | 1
03 Servos con encoder | 3
04 Soportes de hombro | 1 par
05 Brazo superior | 1
06 Antebrazo | 1
07 Bielas de paralelogramo | 1 juego
08 Ejes, cojinetes y separadores | 1 lote
09 Resorte de compensación | 1
10 Portacabezal nivelado | 1
11 Horquilla de torreta | 1
12 Tambor y eje horizontal | 1 conj.
13 Servo selector | 1
14 Indexador, bloqueo y sensor | 1 conj.
15 Cartucho de lápiz con resorte | 1
16 Cartucho de electroimán | 1
17 Cartucho de pinza y microservo | 1
18 Sensores capacitivo + inductivo | 1 par
19 Arduino, potencia y fuente | 1 conj.
20 Tornillos, insertos y cableado | 1 lote
Allocate sufficient height to table, shrinking the operational drawing only if necessary.
3. Footer date 24-09-2026, add concise footer "70 g: objetivo por validar. Electroimán para ferromagnéticos." Keep "PROPUESTA CONCEPTUAL · SIN ESCALA · BOM PRELIMINAR".
4. Correct main arm balloons: 05 points upper arm from shoulder to elbow, 06 points forearm from elbow to wrist, 07 points slender linkage. The base servo is J1, shoulder J2, elbow drive J3.
Keep all typography in Spanish, no invented specs, no accuracy claims.

## Ajuste final del BOM de la segunda lámina

Edit ONLY the bottom BOM table strip in this image, preserving absolutely every other image region, drawing, labels, title, footer and style pixel for pixel. The table contains duplicated/missing numbers and incorrect labels. Replace that strip with four equal width tables next to each other, five data rows per table, each having three columns "N°", "Pieza", "Cant.". No illustrations in the strip. Draw ample room and type crisp small dark text. Do not attempt 10 rows in the short strip. Four blocks of exactly five rows as follows:
BLOCK ONE, IDs 01-05:
01 | Tablero y base fija | 1 conj.
02 | Plataforma J1 | 1
03 | Servos con encoder | 3
04 | Soportes de hombro | 1 par
05 | Brazo superior | 1
BLOCK TWO, IDs 06-10:
06 | Antebrazo | 1
07 | Bielas | 1 juego
08 | Ejes y cojinetes | 1 lote
09 | Resorte | 1
10 | Portacabezal | 1
BLOCK THREE, IDs 11-15:
11 | Horquilla | 1
12 | Tambor y eje | 1 conj.
13 | Servo selector | 1
14 | Bloqueo y sensor | 1 conj.
15 | Cartucho de lápiz | 1
BLOCK FOUR, IDs 16-20:
16 | Electroimán | 1
17 | Pinza y microservo | 1
18 | Sensores de material | 1 par
19 | Control y fuente | 1 conj.
20 | Tornillos y cableado | 1 lote
Each number 01 through 20 appears exactly once in this table. Do not merge rows. Do not repeat groups. Keep heading "LISTA DE MATERIALES (BOM PRELIMINAR)". Preserve date and conceptual footer.

Herramienta: image_gen integrada, dos generaciones independientes.

## Propuesta 01

Use case: infographic-diagram. Create a polished engineering proposal sheet for a university MathBot, in SPANISH. Wide landscape 3:2, very high resolution, ideally 3840 pixels wide. White warm drafting paper, graphite pencil outlines and crosshatching, faint construction lines, restrained pale blue mechanical panels, orange-red thin leaders and numbered balloons. Not a photorealistic render. Legible carefully typeset technical Spanish labels, clean generous whitespace, no labels crossing objects. A cohesive professional pencil technical drawing like an exploded assembly drawing, with full robot clearly visible. Main assembled perspective 55% left; exploded mechanism detail upper right; numbered illustrated parts layout and compact BOM lower strip/right. All parts numbered consistently. Include a drawing title block and clearly write "PROPUESTA CONCEPTUAL · SIN ESCALA · BOM PRELIMINAR". Do not claim manufacturing-ready dimensions, guaranteed accuracy, proven payload, or source model compatibility. Show the actual MathBot three-petal rose drawn in blue on paper on the table (one petal toward left, two toward upper/lower right), a metal test object labelled "70 g · objetivo de carga", and a separate nonmetal test object. End effector includes capacitive plus auxiliary inductive material sensing, electromagnet, a pen/pencil module, and mechanical gripper. Detection of material is distinct from tool-position sensing. A ballpoint/Sharpie held vertically, with spring compliant holder, traces the rose. The magnet is a wound coil on iron core, clearly NOT a suction cup. The mechanical gripper is two jaws, with small dedicated servo. Sensors point toward the target, not toward another metal tool. Tool exchange or selection happens lifted above the sheet. All cables have plausible routing. Keep the board beautiful, detailed and physically intelligible.
TITLE exactly: "MATHBOT / 01 — SCARA CON CAMBIO AUTOMÁTICO".
Input image 1 is a mechanical architecture and annotation reference only: HowToMechatronics blue SCARA with tall rod tower and two horizontal belt-driven arms. Create a NEW drawing adapting it, not copying its gripper. Retain recognisable base, 4 vertical guide rods, lead screw, sliding carriage, two horizontal articulated links, bearing-supported rotary joints and GT2 belts with tensioners; adapt to two planar joints plus Z, omit original rotary wrist. Main illustration has one pen module attached; rack holds the magnet and gripper modules plus one empty pen bay. TWO horizontal arm links each nominal 200 mm center-to-center, dimension arrows marked "200 mm · propuesta". Show small plan inset with "Centro de rosa: D = 220 mm" from base axis, not the outer board dimension. Four smooth rods and one central T8 lead screw raise both arm links on their carriage. Actuation proposal uses 2 encoder feedback rotary servos with toothed belts (not stock NEMA xy), plus one NEMA17 for Z, to adapt source geometry to course servomotor verification. Label "2R + Z". Do not label any reduction ratio.
Automatic changer enlarged exploded detail: wrist receiver flange, servo-operated radial sliding latch pin, mechanical tapered locating surfaces + antirotation key, contact pogo block, common tool adapter plate underneath. Dashed vertical axis shows assembly. Servo retracts pin only over a three-bay docking station; no magnetic-only coupling. Fixed sensor bracket alongside receiver remains on robot across tools. Rack bay descriptions "LÁPIZ", "ELECTROIMÁN", "PINZA". Each tool detachable; common plate seats into latch. Magnet wiring through pogo contacts from MOSFET driver with flyback diode. Separate micro switch confirms lock engagement.
BOM numbered exactly with small corresponding sketches and quantities, space it into two columns if needed:
01 Tablero de trabajo — 1
02 Base y giro J1 — 1 conj.
03 Servos con encoder — 2
04 Guías verticales — 4
05 Husillo T8 y tuerca — 1 conj.
06 Motor Z y acople — 1 conj.
07 Carro y cojinetes lineales — 1 conj.
08 Brazo 1 — 1
09 Junta J2 y rodamientos — 1 conj.
10 Brazo 2 — 1
11 Correas GT2, poleas y tensores — 2 juegos
12 Receptor y pestillo con servo — 1 conj.
13 Contactos y placas de herramienta — 1 juego
14 Sensores capacitivo + inductivo — 1 par
15 Portaplumas con resorte — 1
16 Electroimán bobinado — 1
17 Pinza y microservo — 1 conj.
18 Estación de tres puestos — 1
19 Arduino, potencia y fuente — 1 conj.
20 Tornillos, insertos y cableado — 1 lote
Use compact callouts on main assembled drawing for key numbers 02 03 04 05 06 07 08 09 10 12 14 15 18 19. Exploded detail identifies 12 13 14, and latch switch with descriptive label. Lower row shows 15 pen,16 magnet,17 gripper as separate complete cartridge modules. Brief sequence "ELEVAR → ESTACIONAR → LIBERAR → ACOPLAR → VERIFICAR". Tiny footer "Inspirado en HowToMechatronics; adaptación MathBot."

## Propuesta 02

Use case: infographic-diagram. Create a polished engineering proposal sheet for a university MathBot, in SPANISH. Wide landscape 3:2, very high resolution, ideally 3840 pixels wide. White warm drafting paper, graphite pencil outlines and crosshatching, faint construction lines, restrained pale blue mechanical panels, orange-red thin leaders and numbered balloons. Not a photorealistic render. Legible carefully typeset technical Spanish labels, clean generous whitespace, no labels crossing objects. A cohesive professional pencil technical drawing like an exploded assembly drawing, with full robot clearly visible. Main assembled perspective 55% left; exploded mechanism detail upper right; numbered illustrated parts layout and compact BOM lower strip/right. All parts numbered consistently. Include a drawing title block and clearly write "PROPUESTA CONCEPTUAL · SIN ESCALA · BOM PRELIMINAR". Do not claim manufacturing-ready dimensions, guaranteed accuracy, proven payload, or source model compatibility. Show the actual MathBot three-petal rose drawn in blue on paper on the table (one petal toward left, two toward upper/lower right), a metal test object labelled "70 g · objetivo de carga", and a separate nonmetal test object. End effector includes capacitive plus auxiliary inductive material sensing, electromagnet, a pen/pencil module, and mechanical gripper. Detection of material is distinct from tool-position sensing. A ballpoint/Sharpie held vertically, with spring compliant holder, traces the rose. The magnet is a wound coil on iron core, clearly NOT a suction cup. The mechanical gripper is two jaws, with small dedicated servo. Sensors point toward the target, not toward another metal tool. Tool exchange or selection happens lifted above the sheet. All cables have plausible routing. Keep the board beautiful, detailed and physically intelligible.
TITLE exactly: "MATHBOT / 02 — EEZY CON TORRETA MODULAR".
Input image 1 is the actual local MathBot Mk2 kinematic simulation (geometry reference only, not visual style). Render a mechanically plausible anthropomorphic EEZYbotARM Mk2 derivative with round rotating base, twin cheek shoulder supports, short rising upper arm, long descending forearm, paired parallelogram link rods maintaining distal carrier level. Clearly different from SCARA: articulated joints bend in vertical plane, no tall Z tower and no horizontal SCARA links. Three main encoder servos act on base/shoulder/elbow; shoulder counterbalance spring and bearings on both sides of joint. Proposed reinforced ribbed printed plates. Small side dimension inset shows reference chain only "L1 92 · L2 135 · L3 147 · L4 87 mm" with caption "Geometría del modelo; TCP nuevo por recalibrar". Mark "3 GDL + selector".
New automatic head is compact lightweight three-position drum turret on a HORIZONTAL axle, mounted in a U-yoke on level wrist carrier. Exactly THREE radial replaceable cartridges spaced 120 degrees: spring pen holder, wound-core electromagnet, 2-jaw gripper. In drawing the active pen points straight down; other two tools point obliquely up away from paper, avoiding collision. Servo/index drive mounted on stationary yoke rotates horizontal shaft; detent locking pin locks in each of 3 positions, microswitch confirms locked index, small separate home/index flag. Mechanical bearings support drum, servo shaft does not carry radial load alone. Tools held in screwed cartridges for maintenance, automatic selection occurs by rotating drum not removing tools. A fixed small side sensor bracket with capacitive plate and inductive probe points down toward test target; it does not rotate with drum. Cable service loop labelled "Giro limitado; retorno de cable"; do NOT suggest unlimited continuous spinning. Label "Seleccionar a altura segura".
Exploded turret upper right: yoke, shaft, pair of bearings, triangular 3-station drum, index disc, servo drive, locking pin + switch, three independent cartridges, cable connector; dotted aligned assembly axes. Show exactly one operational pen plus parked magnet and gripper on the assembled turret, and exploded duplicates confined to inset.
BOM numbered exactly:
01 Tablero y base fija — 1 conj.
02 Plataforma giratoria J1 — 1
03 Servos con encoder — 3
04 Soportes de hombro — 1 par
05 Brazo superior — 1
06 Antebrazo — 1
07 Bielas de paralelogramo — 1 juego
08 Ejes, cojinetes y separadores — 1 lote
09 Resorte de compensación — 1
10 Portacabezal nivelado — 1
11 Horquilla de torreta — 1
12 Tambor y eje horizontal — 1 conj.
13 Servo selector — 1
14 Indexador, bloqueo y sensor — 1 conj.
15 Cartucho de lápiz con resorte — 1
16 Cartucho de electroimán — 1
17 Cartucho de pinza y microservo — 1
18 Sensores capacitivo + inductivo — 1 par
19 Arduino, potencia y fuente — 1 conj.
20 Tornillos, insertos y cableado — 1 lote
Main numbered leader labels identify 02 03 04 05 06 07 09 10 11 15 18 19. Highlight automatic head zoom with 11 through 18. Pen coil and spring are distinct from magnet coil.
Brief sequence "ELEVAR → DESBLOQUEAR → GIRAR 120° → BLOQUEAR → VERIFICAR".
Footer "Derivado de EEZYbotARM Mk2 / easyEEZYbotARM. Validar carga, colisiones y límites reales."
