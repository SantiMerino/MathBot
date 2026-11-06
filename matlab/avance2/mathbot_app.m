function fig = mathbot_app()
%MATHBOT_APP  App interactiva del MathBot: SCARA de PLA negro con el cabezal de disco v3.
%   mathbot_app        abre la app (carpeta actual = matlab/avance2 o en el path)
%
%   Izquierda:  Inicio (geometria, herramienta, codo, limites) · Modo Jog (articular y de la punta)
%               Cinematica (directa e inversa, jacobiano) · Trayectorias (mision de la rosa)
%   Derecha:    Vista 3D (piezas reales del robot) · Espacio de trabajo · Error de seguimiento ·
%               Articulaciones;  abajo, la cinematica directa de la punta en vivo.
%
%   Usa las mismas funciones que la simulacion (mathbot_parametros, mathbot_fk, mathbot_ik,
%   mathbot_jacobiano, mathbot_mallas, mathbot_error_trazo) y la mision de trayectoria_mathbot.
%   Programada con uifigure (lo mismo que App Designer, pero en un .m editable).

aqui = fileparts(mfilename('fullpath'));
P = mathbot_parametros();
archRef = fullfile(aqui, 'referencia_mathbot.mat');
if ~isfile(archRef)
    viejo = cd(aqui);
    evalin('base', 'trayectoria_mathbot;');
    cd(viejo);
    close(findall(0, 'Type', 'figure', 'Name', 'MATHBOT - mision'));
end
REF = getfield(load(archRef, 'REF'), 'REF'); %#ok<GFLD>
E = mathbot_error_trazo(REF.P, true, 20);
C = mathbot_mallas(fullfile(aqui, 'meshes'));
nombresHerr = {'Plumon', 'Electroiman', 'Sensor inductivo'};

% ---------- estado ----------
q = REF.q(1, :);  lev = P.LEVANTE;  herr = 1;
tPlay = 0;  vel = 1;  reproduciendo = false;  t0 = uint64(0);  tIni = 0;
tintaX = [];  tintaY = [];
Le = P.L2 + P.R;

% ---------- ventana ----------
fig = uifigure('Name', 'MATHBot - SCARA virtual', 'Position', [40 40 1440 820]);
try, theme(fig, 'light'); catch, end
gPrin = uigridlayout(fig, [1 2], 'ColumnWidth', {470, '1x'}, 'Padding', [8 8 8 8], 'ColumnSpacing', 8);

%% ===================== IZQUIERDA =====================
tgIzq = uitabgroup(gPrin);
tInicio = uitab(tgIzq, 'Title', 'Inicio');
tJog    = uitab(tgIzq, 'Title', 'Modo Jog');
tCin    = uitab(tgIzq, 'Title', 'Cinematica');
tTray   = uitab(tgIzq, 'Title', 'Trayectorias');

% ----- Inicio -----
g = uigridlayout(tInicio, [6 1], 'RowHeight', {30, 92, 150, 92, '1x', 34}, 'Padding', [10 10 10 10]);
uilabel(g, 'Text', 'MATHBot · SCARA virtual', 'FontSize', 18, 'FontWeight', 'bold');
uitextarea(g, 'Editable', 'off', 'Value', { ...
    'Prototipo virtual del MathBot: SCARA de HowToMechatronics impreso en PLA negro con el cabezal de disco v3 (plumon, electroiman KK-P20/15 y sensor LJ18A3 a 55 mm de J3).', ...
    'Juntas: J1 (columna), Z (plataforma), J2 (brazo 2), J3 (cabezal) y el levante del plumon. La cinematica, la mision y los limites son los del firmware (firmware/mathbot_mega v3.0).'});
pGeo = uipanel(g, 'Title', 'Geometria (STL updated + cabezal de disco)');
gg = uigridlayout(pGeo, [1 1], 'Padding', [4 4 4 4]);
rmin = sqrt(P.L1^2 + Le^2 + 2*P.L1*Le*cosd(P.LIM_J));
uitextarea(gg, 'Editable', 'off', 'FontName', 'Consolas', 'Value', { ...
    sprintf('L1 (eje J1 -> eje J2)        = %.1f mm', P.L1), ...
    sprintf('L2 (eje J2 -> eje J3)        = %.1f mm', P.L2), ...
    sprintf('Herramientas a R = %.0f mm de J3 (0 / 120 / 240 deg)', P.R), ...
    sprintf('Con la herramienta al frente: Le = L2 + R = %.0f mm', Le), ...
    sprintf('Alcance de la punta: %.1f a %.1f mm (|J2| <= %d deg)', rmin, P.L1 + Le, P.LIM_J), ...
    sprintf('Punta del plumon en la hoja con Z = %.1f mm', P.CAIDA + P.DISCO + P.BAJO(1)), ...
    sprintf('HOME: J1 %.1f, J2 %.1f, J3 %.0f deg, Z %.0f mm', P.home)});
pMod = uipanel(g, 'Title', 'Herramienta activa y configuracion del codo');
gm = uigridlayout(pMod, [2 2], 'ColumnWidth', {110, '1x'}, 'Padding', [6 6 6 6]);
uilabel(gm, 'Text', 'Herramienta');
ddHerr = uidropdown(gm, 'Items', nombresHerr, 'Value', nombresHerr{1}, 'ValueChangedFcn', @cambiarHerr);
uilabel(gm, 'Text', 'Codo');
ddCodo = uidropdown(gm, 'Items', {'Derecha (theta2 < 0, firmware)', 'Izquierda (theta2 > 0)'}, ...
    'Value', 'Derecha (theta2 < 0, firmware)');
pLim = uipanel(g, 'Title', 'Limites y parametros de operacion (editables)');
gl = uigridlayout(pLim, [5 3], 'ColumnWidth', {'1x', 80, 80}, 'RowHeight', repmat({24}, 1, 5), 'Padding', [6 6 6 6]);
uilabel(gl, 'Text', 'theta1 min / max [deg]');
efT1min = uieditfield(gl, 'numeric', 'Value', -P.LIM_J);  efT1max = uieditfield(gl, 'numeric', 'Value', P.LIM_J);
uilabel(gl, 'Text', 'theta2 min / max [deg]');
efT2min = uieditfield(gl, 'numeric', 'Value', -P.LIM_J);  efT2max = uieditfield(gl, 'numeric', 'Value', P.LIM_J);
uilabel(gl, 'Text', 'Z min / max [mm]');
efZmin = uieditfield(gl, 'numeric', 'Value', P.ZMIN);  efZmax = uieditfield(gl, 'numeric', 'Value', P.ZMAX);
uilabel(gl, 'Text', 'Velocidad de trazo [mm/s]');
efVel = uieditfield(gl, 'numeric', 'Value', P.v_trazo, 'Editable', 'off');  uilabel(gl, 'Text', '(firmware)');
uilabel(gl, 'Text', 'Resolucion J1 / J2 [deg/paso]');
uilabel(gl, 'Text', sprintf('%.4f', 1/P.PASOS(1)));  uilabel(gl, 'Text', sprintf('%.4f', 1/P.PASOS(2)));
gb = uigridlayout(g, [1 3], 'Padding', [0 0 0 0]);
uibutton(gb, 'Text', 'Ir a Home', 'ButtonPushedFcn', @(~, ~) animarHacia(P.home, P.LEVANTE));
uibutton(gb, 'Text', 'Vista 3D por defecto', 'ButtonPushedFcn', @(~, ~) vistaDefecto());
cbAlc = uicheckbox(gb, 'Text', 'Mostrar alcance', 'Value', true, 'ValueChangedFcn', @(~, ~) mostrarAlcance());

% ----- Modo Jog -----
g = uigridlayout(tJog, [3 1], 'RowHeight', {230, 190, '1x'}, 'Padding', [10 10 10 10]);
pArt = uipanel(g, 'Title', 'Jog articular');
ga = uigridlayout(pArt, [5 3], 'ColumnWidth', {70, '1x', 70}, 'RowHeight', {34, 34, 34, 34, 26}, 'Padding', [6 6 6 6]);
[slT1, efJ1] = filaSlider(ga, 'theta1 [deg]', [-P.LIM_J P.LIM_J], q(1), 1);
[slT2, efJ2] = filaSlider(ga, 'theta2 [deg]', [-170 170], q(2), 2);
[slPhi, efJ3] = filaSlider(ga, 'phi J3 [deg]', [-170 170], q(3), 3);
[slZ, efJZ] = filaSlider(ga, 'Z [mm]', [P.ZMIN - 40 P.ZMAX], q(4), 4);
uilabel(ga, 'Text', 'Plumon');
cbPluma = uicheckbox(ga, 'Text', 'abajo (traza)', 'Value', false, 'ValueChangedFcn', @cambiarPluma);
uilabel(ga, 'Text', '');
pPunta = uipanel(g, 'Title', 'Jog de la punta (cinematica inversa)');
gp = uigridlayout(pPunta, [4 4], 'ColumnWidth', {'1x', '1x', '1x', '1x'}, 'RowHeight', {26, 30, 30, 30}, 'Padding', [6 6 6 6]);
uilabel(gp, 'Text', 'Paso [mm]');
ddPaso = uidropdown(gp, 'Items', {'0.5', '1', '5', '10', '20'}, 'Value', '5');
uilabel(gp, 'Text', '');  uilabel(gp, 'Text', '');
uibutton(gp, 'Text', 'X -', 'ButtonPushedFcn', @(~, ~) jogPunta(-1, 0, 0));
uibutton(gp, 'Text', 'X +', 'ButtonPushedFcn', @(~, ~) jogPunta(1, 0, 0));
uibutton(gp, 'Text', 'Y -', 'ButtonPushedFcn', @(~, ~) jogPunta(0, -1, 0));
uibutton(gp, 'Text', 'Y +', 'ButtonPushedFcn', @(~, ~) jogPunta(0, 1, 0));
uibutton(gp, 'Text', 'Z -', 'ButtonPushedFcn', @(~, ~) jogPunta(0, 0, -1));
uibutton(gp, 'Text', 'Z +', 'ButtonPushedFcn', @(~, ~) jogPunta(0, 0, 1));
uibutton(gp, 'Text', 'Punta a la hoja', 'ButtonPushedFcn', @(~, ~) puntaAHoja());
uibutton(gp, 'Text', 'Borrar tinta', 'ButtonPushedFcn', @(~, ~) borrarTinta());
lblJog = uilabel(gp, 'Text', '', 'FontColor', [0.7 0.1 0.1]);
lblJog.Layout.Row = 4;  lblJog.Layout.Column = [1 4];
uitextarea(g, 'Editable', 'off', 'Value', { ...
    'Jog articular: mueve cada junta como el comando J del firmware.', ...
    'Jog de la punta: resuelve la cinematica inversa con la herramienta activa al frente (J3 = -PHI). Si un punto se sale del alcance o de los limites, el robot no se mueve y se avisa en rojo.', ...
    'Con el plumon abajo y la punta en la hoja (z = 0) se deja tinta.'});

% ----- Cinematica -----
g = uigridlayout(tCin, [3 1], 'RowHeight', {200, 250, '1x'}, 'Padding', [10 10 10 10]);
pFK = uipanel(g, 'Title', 'Cinematica directa: juntas -> punta');
gf = uigridlayout(pFK, [5 4], 'ColumnWidth', {90, '1x', 90, '1x'}, 'RowHeight', {26, 26, 30, 26, 26}, 'Padding', [6 6 6 6]);
uilabel(gf, 'Text', 'theta1 [deg]');  efFK1 = uieditfield(gf, 'numeric', 'Value', q(1));
uilabel(gf, 'Text', 'theta2 [deg]');  efFK2 = uieditfield(gf, 'numeric', 'Value', q(2));
uilabel(gf, 'Text', 'phi J3 [deg]');  efFK3 = uieditfield(gf, 'numeric', 'Value', q(3));
uilabel(gf, 'Text', 'Z [mm]');        efFK4 = uieditfield(gf, 'numeric', 'Value', q(4));
b = uibutton(gf, 'Text', 'Calcular y mover', 'ButtonPushedFcn', @calcularFK);  b.Layout.Column = [1 2];
b = uibutton(gf, 'Text', 'Copiar pose actual', 'ButtonPushedFcn', @(~, ~) copiarPose());  b.Layout.Column = [3 4];
lblFK = uilabel(gf, 'Text', '', 'FontName', 'Consolas');  lblFK.Layout.Row = [4 5];  lblFK.Layout.Column = [1 4];
pIK = uipanel(g, 'Title', 'Cinematica inversa: punta -> juntas');
gi = uigridlayout(pIK, [4 4], 'ColumnWidth', {90, '1x', 90, '1x'}, 'RowHeight', {26, 30, '1x', 30}, 'Padding', [6 6 6 6]);
uilabel(gi, 'Text', 'x [mm]');  efIKx = uieditfield(gi, 'numeric', 'Value', 250);
uilabel(gi, 'Text', 'y [mm]');  efIKy = uieditfield(gi, 'numeric', 'Value', 0);
b = uibutton(gi, 'Text', 'Calcular IK', 'ButtonPushedFcn', @calcularIK);  b.Layout.Column = [1 2];
b = uibutton(gi, 'Text', 'Mover el robot', 'ButtonPushedFcn', @moverIK);  b.Layout.Column = [3 4];
lblIK = uilabel(gi, 'Text', '', 'FontName', 'Consolas', 'VerticalAlignment', 'top');
lblIK.Layout.Row = [3 4];  lblIK.Layout.Column = [1 4];
uitextarea(g, 'Editable', 'off', 'FontName', 'Consolas', 'Value', { ...
    'x = L1 cos(t1) + L2 cos(t1+t2) + R cos(t1+t2+phi+PHI_h)', ...
    'y = L1 sin(t1) + L2 sin(t1+t2) + R sin(t1+t2+phi+PHI_h)', ...
    'z = Z - 80.5 - 20 - BAJO_h (+ levante si es el plumon)', ...
    'IK con la herramienta al frente: 2R de L1 y Le = L2 + R', ...
    '  cos(t2) = (x^2 + y^2 - L1^2 - Le^2) / (2 L1 Le)', ...
    '  t1 = atan2(y, x) - atan2(Le sin t2, L1 + Le cos t2)', ...
    'Jacobiano: dp = J dtheta;  kappa = s_max / s_min'});

% ----- Trayectorias -----
g = uigridlayout(tTray, [5 1], 'RowHeight', {120, 110, 110, 130, '1x'}, 'Padding', [10 10 10 10]);
pRosa = uipanel(g, 'Title', 'Trayectoria: rosa de tres petalos (Avance 1)');
gr = uigridlayout(pRosa, [1 1], 'Padding', [4 4 4 4]);
uitextarea(gr, 'Editable', 'off', 'FontName', 'Consolas', 'Value', { ...
    'x(t) = -A cos(3t) cos(t),  y(t) = -A k cos(3t) sin(t)', ...
    sprintf('A = %.1f mm, k = %.4f, t de %.3f*pi a %.3f*pi', P.A, P.k, P.t0/pi, P.t1/pi), ...
    sprintf('Centro (%.0f, %.0f) mm, giro %.0f deg (ubicacion optimizada)', P.centro, P.giro), ...
    sprintf('Largo %.1f mm en %d tramos de 1 mm a %.0f mm/s', REF.largo, size(REF.waypoints, 1) - 1, P.v_trazo)});
pCtrl = uipanel(g, 'Title', 'Reproducir la mision (HOME -> rosa -> HOME, como la orden D del firmware)');
gc = uigridlayout(pCtrl, [2 4], 'RowHeight', {32, 30}, 'Padding', [6 6 6 6]);
bPlay = uibutton(gc, 'Text', 'Reproducir', 'ButtonPushedFcn', @reproducir, 'BackgroundColor', [0.80 0.92 0.82]);
uibutton(gc, 'Text', 'Pausa', 'ButtonPushedFcn', @(~, ~) pausar());
uibutton(gc, 'Text', 'Reiniciar', 'ButtonPushedFcn', @(~, ~) reiniciar());
ddVel = uidropdown(gc, 'Items', {'0.5x', '1x', '2x', '4x', '8x'}, 'Value', '1x', 'ValueChangedFcn', @cambiarVel);
slTiempo = uislider(gc, 'Limits', [0 REF.t(end)], 'Value', 0, 'ValueChangingFcn', @moverTiempo);
slTiempo.Layout.Column = [1 4];
pEst = uipanel(g, 'Title', 'Estado');
ge = uigridlayout(pEst, [1 1], 'Padding', [6 6 6 6]);
lblEst = uilabel(ge, 'Text', '', 'FontName', 'Consolas', 'VerticalAlignment', 'top');
pRes = uipanel(g, 'Title', 'Resultados de la simulacion (deseada vs ejecutada)');
gs = uigridlayout(pRes, [1 1], 'Padding', [4 4 4 4]);
uitextarea(gs, 'Editable', 'off', 'FontName', 'Consolas', 'Value', { ...
    sprintf('Error de trayectoria: max %.4f mm | RMS %.4f mm', E.emax, E.erms), ...
    sprintf('Precision del trazo simulado: %.3f %%', E.precision), ...
    sprintf('Mision completa: %.1f s (trazo %.1f s)', REF.t(end), REF.t_fin_trazo - REF.t_ini_trazo), ...
    'Fuentes del error: tramos rectos de 1 mm y redondeo a pasos', ...
    'enteros (1/4 de micropaso). Video: simular_mathbot.'});
uilabel(g, 'Text', '');

%% ===================== DERECHA =====================
gDer = uigridlayout(gPrin, [2 1], 'RowHeight', {'1x', 74}, 'Padding', [0 0 0 0]);
tgDer = uitabgroup(gDer);
t3D  = uitab(tgDer, 'Title', 'Vista 3D');
tEsp = uitab(tgDer, 'Title', 'Espacio de trabajo');
tErr = uitab(tgDer, 'Title', 'Error de seguimiento');
tArt = uitab(tgDer, 'Title', 'Articulaciones');

% ----- Vista 3D -----
g3 = uigridlayout(t3D, [1 1], 'Padding', [4 4 4 4]);
ax3 = uiaxes(g3);
hold(ax3, 'on');  grid(ax3, 'on');  box(ax3, 'on');  axis(ax3, 'equal');
xlabel(ax3, 'x [mm]');  ylabel(ax3, 'y [mm]');  zlabel(ax3, 'z [mm]');
patch(ax3, 'XData', [-260 480 480 -260], 'YData', [-380 -380 380 380], 'ZData', -0.6 * [1 1 1 1], ...
      'FaceColor', [0.88 0.87 0.84], 'EdgeColor', 'none', 'FaceLighting', 'none');
hx = 279/2;  hy = 216/2;
patch(ax3, 'XData', P.centro(1) + [-hx hx hx -hx], 'YData', P.centro(2) + [-hy -hy hy hy], 'ZData', -0.1 * [1 1 1 1], ...
      'FaceColor', [1 1 1], 'EdgeColor', [0.7 0.7 0.7], 'FaceLighting', 'none');
plot3(ax3, REF.rosa(:, 1), REF.rosa(:, 2), 0.05 * ones(size(REF.rosa, 1), 1), '--', 'Color', [0.15 0.3 0.75], 'LineWidth', 1.2);
a = linspace(0, 2*pi, 241);
hAlc3 = [plot3(ax3, (P.L1 + Le) * cos(a), (P.L1 + Le) * sin(a), 0.1 * ones(size(a)), '--', 'Color', [0.35 0.35 0.35]), ...
         plot3(ax3, rmin * cos(a), rmin * sin(a), 0.1 * ones(size(a)), ':', 'Color', [0.35 0.35 0.35])];
hTinta3 = plot3(ax3, nan, nan, nan, '-', 'Color', P.color_tinta, 'LineWidth', 2.2);
hTintaM3 = plot3(ax3, nan, nan, nan, '-', 'Color', P.color_tinta, 'LineWidth', 2.2);
hPunta3 = plot3(ax3, nan, nan, nan, 'o', 'MarkerSize', 6, 'MarkerFaceColor', [0.95 0.2 0.5], 'MarkerEdgeColor', 'k');
H = gobjects(numel(C), 1);
for i = 1:numel(C)
    if isempty(C(i).padre)
        padre = ax3;
    else
        padre = H(strcmp({C(1:i-1).nombre}, C(i).padre));
    end
    H(i) = hgtransform('Parent', padre, 'Matrix', makehgtform('translate', C(i).origen));
    patch('Parent', H(i), 'Faces', C(i).F, 'Vertices', C(i).V, 'FaceColor', C(i).rgb, 'EdgeColor', 'none', ...
          'FaceLighting', 'flat', 'AmbientStrength', 0.45, 'DiffuseStrength', 0.75, ...
          'SpecularStrength', 0.35, 'SpecularExponent', 12, 'BackFaceLighting', 'lit');
end
movil = find(~strcmp({C.tipo}, 'fixed') & ~strcmp({C.tipo}, 'raiz'));
light(ax3, 'Position', [-300 -700 900], 'Style', 'infinite');
light(ax3, 'Position', [700 500 400], 'Style', 'infinite', 'Color', [0.55 0.55 0.6]);
xlim(ax3, [-260 480]);  ylim(ax3, [-380 380]);  zlim(ax3, [0 430]);
vistaDefecto();

% ----- Espacio de trabajo -----
g2 = uigridlayout(tEsp, [1 1], 'Padding', [4 4 4 4]);
ax2 = uiaxes(g2);
hold(ax2, 'on');  grid(ax2, 'on');  box(ax2, 'on');  axis(ax2, 'equal');
xlabel(ax2, 'x [mm]');  ylabel(ax2, 'y [mm]');
anillo = [(P.L1 + Le) * [cos(a); sin(a)], rmin * [cos(fliplr(a)); sin(fliplr(a))]];
patch(ax2, anillo(1, :), anillo(2, :), [0.2 0.5 0.9], 'FaceAlpha', 0.10, 'EdgeColor', [0.2 0.5 0.9]);
patch(ax2, P.BASE([1 2 2 1]), P.BASE([3 3 4 4]), [0.12 0.12 0.14], 'EdgeColor', 'none');
patch(ax2, P.CAJA([1 2 2 1]), P.CAJA([3 3 4 4]), [0.30 0.30 0.32], 'EdgeColor', 'none');
plot(ax2, REF.rosa(:, 1), REF.rosa(:, 2), '--', 'Color', [0.85 0.2 0.2], 'LineWidth', 1.2);
hTinta2 = plot(ax2, nan, nan, '-', 'Color', P.color_tinta, 'LineWidth', 2);
hTintaM2 = plot(ax2, nan, nan, '-', 'Color', P.color_tinta, 'LineWidth', 2);
hBrazo2 = plot(ax2, nan, nan, '-o', 'Color', [0.1 0.1 0.12], 'LineWidth', 3, 'MarkerFaceColor', [0.5 0.5 0.5]);
hPunta2 = plot(ax2, nan, nan, 'o', 'MarkerSize', 8, 'MarkerFaceColor', [0.95 0.2 0.5], 'MarkerEdgeColor', 'k');
title(ax2, sprintf('Espacio de trabajo de la punta: anillo %.0f a %.0f mm', rmin, P.L1 + Le));
xlim(ax2, [-450 450]);  ylim(ax2, [-450 450]);

% ----- Error de seguimiento -----
gE = uigridlayout(tErr, [2 1], 'RowHeight', {'1x', '1x'}, 'Padding', [4 4 4 4]);
axE = uiaxes(gE);
plot(axE, E.s, E.e, '-', 'Color', P.color_tinta);  hold(axE, 'on');  grid(axE, 'on');
yline(axE, P.tol_mm, 'r--');
hCurE = xline(axE, 0, 'k-', 'LineWidth', 1.2);
xlabel(axE, 'largo de arco recorrido [mm]');  ylabel(axE, 'e [mm]');
ylim(axE, [0 1.25 * P.tol_mm]);
title(axE, sprintf('Distancia de la punta ejecutada a la curva deseada: max %.3f mm, RMS %.3f mm', E.emax, E.erms));
axZ = uiaxes(gE);
hold(axZ, 'on');  axis(axZ, 'equal');  grid(axZ, 'on');  box(axZ, 'on');
[~, ip] = max(hypot(E.deseada(:, 1) - P.centro(1), E.deseada(:, 2) - P.centro(2)));
c0 = E.deseada(ip, :);
plot(axZ, E.deseada(:, 1), E.deseada(:, 2), '-', 'Color', [0.85 0.2 0.2], 'LineWidth', 3);
plot(axZ, E.ej(:, 1), E.ej(:, 2), '-', 'Color', P.color_tinta, 'LineWidth', 1.2);
plot(axZ, E.wp(:, 1), E.wp(:, 2), 'k.', 'MarkerSize', 10);
xlim(axZ, c0(1) + [-4 4]);  ylim(axZ, c0(2) + [-4 4]);
legend(axZ, {'deseada', 'ejecutada', 'puntos del trazo (1 mm)'}, 'Location', 'eastoutside');
title(axZ, 'Acercamiento a la punta de un petalo (8 x 8 mm)');

% ----- Articulaciones -----
gA = uigridlayout(tArt, [2 1], 'Padding', [4 4 4 4]);
axA = uiaxes(gA);
plot(axA, REF.t, REF.q(:, 1:3), 'LineWidth', 1.3);  hold(axA, 'on');  grid(axA, 'on');
hCurA = xline(axA, 0, 'k-', 'LineWidth', 1.2);
xline(axA, REF.t_ini_trazo, '--');  xline(axA, REF.t_fin_trazo, '--');
legend(axA, {'\theta_1', '\theta_2', '\phi (J3)'}, 'Location', 'eastoutside');
ylabel(axA, 'angulo [deg]');  title(axA, 'Referencias articulares de la mision');
axB = uiaxes(gA);
plot(axB, REF.t, REF.q(:, 4), REF.t, REF.lev + P.ZMIN - 20, 'LineWidth', 1.3);  hold(axB, 'on');  grid(axB, 'on');
hCurB = xline(axB, 0, 'k-', 'LineWidth', 1.2);
legend(axB, {'Z plataforma', 'levante del plumon (desplazado)'}, 'Location', 'eastoutside');
xlabel(axB, 't [s]');  ylabel(axB, '[mm]');

% ----- panel inferior: cinematica directa en vivo -----
pDir = uipanel(gDer, 'Title', 'Cinematica directa (punta de la herramienta activa)');
gd = uigridlayout(pDir, [1 8], 'ColumnWidth', {50, '1x', 50, '1x', 50, '1x', 140, 130}, 'Padding', [6 4 6 4]);
uilabel(gd, 'Text', 'x [mm]', 'HorizontalAlignment', 'right');  efX = uieditfield(gd, 'numeric', 'Editable', 'off', 'ValueDisplayFormat', '%.2f');
uilabel(gd, 'Text', 'y [mm]', 'HorizontalAlignment', 'right');  efY = uieditfield(gd, 'numeric', 'Editable', 'off', 'ValueDisplayFormat', '%.2f');
uilabel(gd, 'Text', 'z [mm]', 'HorizontalAlignment', 'right');  efZ = uieditfield(gd, 'numeric', 'Editable', 'off', 'ValueDisplayFormat', '%.2f');
lblK = uilabel(gd, 'Text', '');
uibutton(gd, 'Text', 'Usar en la IK', 'ButtonPushedFcn', @(~, ~) usarEnIK());

ponerPose(q, lev);
mostrarAlcance();
actualizarEstado(1);

%% ===================== FUNCIONES =====================
    function [sl, ef] = filaSlider(gpad, texto, lims, valor, k)
        uilabel(gpad, 'Text', texto);
        sl = uislider(gpad, 'Limits', lims, 'Value', min(max(valor, lims(1)), lims(2)), ...
            'ValueChangingFcn', @(~, ev) jogArticular(k, ev.Value));
        ef = uieditfield(gpad, 'numeric', 'Value', valor, 'ValueDisplayFormat', '%.2f', ...
            'ValueChangedFcn', @(src, ~) jogArticular(k, src.Value));
    end

    function ponerPose(qn, levn)
        % mueve el robot a qn (deg, mm) y levante levn; actualiza vistas y controles
        q = qn;  lev = levn;
        for j = movil
            switch C(j).junta
                case 'J1', M = makehgtform('zrotate', q(1) * pi/180);
                case 'JZ', M = makehgtform('translate', [0 0 q(4)]);
                case 'J2', M = makehgtform('zrotate', q(2) * pi/180);
                case 'J3', M = makehgtform('zrotate', q(3) * pi/180);
                case 'JP', M = makehgtform('translate', [0 0 lev]);
                otherwise, M = eye(4);
            end
            H(j).Matrix = makehgtform('translate', C(j).origen) * M;
        end
        [p, j2, j3] = mathbot_fk(q, lev, P, herr);
        set(hPunta3, 'XData', p(1), 'YData', p(2), 'ZData', max(p(3), 0.3));
        set(hPunta2, 'XData', p(1), 'YData', p(2));
        set(hBrazo2, 'XData', [0 j2(1) j3(1) p(1)], 'YData', [0 j2(2) j3(2) p(2)]);
        efX.Value = p(1);  efY.Value = p(2);  efZ.Value = p(3);
        % jacobiano con la herramienta al frente (eslabon equivalente Le = L2 + R)
        [~, sM, sm] = mathbot_jacobiano(q(1), q(2), P);
        lblK.Text = sprintf('kappa %.2f | %.2f mm/deg', sM / max(sm, eps), sM * pi/180);
        sincronizarControles();
    end

    function sincronizarControles()
        vals = {slT1, efJ1, q(1); slT2, efJ2, q(2); slPhi, efJ3, q(3); slZ, efJZ, q(4)};
        for k = 1:4
            s = vals{k, 1};
            s.Value = min(max(vals{k, 3}, s.Limits(1)), s.Limits(2));
            vals{k, 2}.Value = vals{k, 3};
        end
        cbPluma.Value = lev < 1;
    end

    function jogArticular(k, v)
        if reproduciendo, return; end
        qn = q;  qn(k) = v;
        lims = [efT1min.Value efT1max.Value; efT2min.Value efT2max.Value; -170 170; efZmin.Value - 40 efZmax.Value];
        qn(k) = min(max(qn(k), lims(k, 1)), lims(k, 2));
        ponerPose(qn, lev);
        tintaManual();
    end

    function cambiarPluma(src, ~)
        if src.Value, animarHacia(q, 0); else, animarHacia(q, P.LEVANTE); end
    end

    function cambiarHerr(src, ~)
        herr = find(strcmp(nombresHerr, src.Value));
        qn = q;  qn(3) = mod(-P.PHI(herr) + 180, 360) - 180;
        animarHacia(qn, lev);
    end

    function [ok, t1, t2] = ikConLimites(x, y)
        Pk = P;
        Pk.codo = ternario(startsWith(ddCodo.Value, 'Derecha'), -1, 1);
        Pk.LIM_J = 180;
        [t1, t2, ok] = mathbot_ik(x, y, Pk);
        ok = ok && t1 >= efT1min.Value && t1 <= efT1max.Value && t2 >= efT2min.Value && t2 <= efT2max.Value;
    end

    function jogPunta(dx, dy, dz)
        if reproduciendo, return; end
        paso = str2double(ddPaso.Value);
        p = mathbot_fk(q, lev, P, herr);
        if dz ~= 0
            qn = q;  qn(4) = min(max(q(4) + dz * paso, efZmin.Value - 40), efZmax.Value);
            ponerPose(qn, lev);  lblJog.Text = '';  tintaManual();
            return;
        end
        x = p(1) + dx * paso;  y = p(2) + dy * paso;
        [ok, t1, t2] = ikConLimites(x, y);
        if ~ok
            lblJog.Text = sprintf('(%.1f, %.1f) fuera del alcance o de los limites', x, y);
            return;
        end
        lblJog.Text = '';
        qn = [t1 t2 mod(-P.PHI(herr) + 180, 360) - 180 q(4)];
        n = max(2, ceil(paso));               % pasos de 1 mm para dejar tinta continua
        for s = 1:n
            ponerPose(q + (qn - q) / (n - s + 1), lev);
            tintaManual();
            drawnow limitrate;
        end
    end

    function puntaAHoja()
        if reproduciendo, return; end
        zp = P.CAIDA + P.DISCO + P.BAJO(herr) + P.zmesa;
        if herr == 1, animarHacia([q(1:3) zp], 0); else, animarHacia([q(1:3) zp], lev); end
    end

    function animarHacia(qObj, levObj)
        if reproduciendo, return; end
        q0 = q;  l0 = lev;  n = 25;
        for s = 1:n
            u = (1 - cos(pi * s / n)) / 2;
            ponerPose(q0 + (qObj - q0) * u, l0 + (levObj - l0) * u);
            tintaManual();
            drawnow limitrate;
        end
    end

    function tintaManual()
        p = mathbot_fk(q, lev, P, 1);
        if lev < 1 && p(3) < 0.5
            tintaX(end+1) = p(1);  tintaY(end+1) = p(2);
            set(hTintaM3, 'XData', tintaX, 'YData', tintaY, 'ZData', 0.25 * ones(size(tintaX)));
            set(hTintaM2, 'XData', tintaX, 'YData', tintaY);
        elseif ~isempty(tintaX) && ~isnan(tintaX(end))
            tintaX(end+1) = nan;  tintaY(end+1) = nan;     % corta el trazo al levantar
        end
    end

    function borrarTinta()
        tintaX = [];  tintaY = [];
        set([hTintaM3 hTinta3], 'XData', nan, 'YData', nan, 'ZData', nan);
        set([hTintaM2 hTinta2], 'XData', nan, 'YData', nan);
    end

    function calcularFK(~, ~)
        qn = [efFK1.Value efFK2.Value efFK3.Value efFK4.Value];
        p = mathbot_fk(qn, lev, P, herr);
        lblFK.Text = {sprintf('Punta (%s): x = %.2f  y = %.2f  z = %.2f mm', nombresHerr{herr}, p), ...
                      sprintf('Distancia al eje J1: %.1f mm', hypot(p(1), p(2)))};
        animarHacia(qn, lev);
    end

    function copiarPose()
        efFK1.Value = q(1);  efFK2.Value = q(2);  efFK3.Value = q(3);  efFK4.Value = q(4);
    end

    function calcularIK(~, ~)
        x = efIKx.Value;  y = efIKy.Value;
        txt = {};
        for codo = [-1 1]
            Pk = P;  Pk.codo = codo;  Pk.LIM_J = 180;
            [t1, t2, ok] = mathbot_ik(x, y, Pk);
            if ok && sign(t2) == codo || ok && t2 == 0
                [~, sM, sm] = mathbot_jacobiano(t1, t2, P);
                txt{end+1} = sprintf('Codo %-9s: t1 = %8.3f  t2 = %8.3f deg  (kappa %.2f, %.2f mm/deg)', ...
                    ternario(codo < 0, 'derecha', 'izquierda'), t1, t2, sM / max(sm, eps), sM * pi/180); %#ok<AGROW>
            end
        end
        if isempty(txt)
            txt = {sprintf('(%.1f, %.1f) fuera del alcance: r = %.1f mm, anillo %.1f a %.1f mm', ...
                   x, y, hypot(x, y), abs(P.L1 - Le), P.L1 + Le)};
        else
            txt{end+1} = sprintf('phi (J3) = %.0f deg para dejar %s al frente', mod(-P.PHI(herr) + 180, 360) - 180, nombresHerr{herr});
        end
        lblIK.Text = txt;
    end

    function moverIK(~, ~)
        calcularIK();
        [ok, t1, t2] = ikConLimites(efIKx.Value, efIKy.Value);
        if ok, animarHacia([t1 t2 mod(-P.PHI(herr) + 180, 360) - 180 q(4)], lev); end
    end

    function usarEnIK()
        efIKx.Value = round(efX.Value, 2);  efIKy.Value = round(efY.Value, 2);
        tgIzq.SelectedTab = tCin;
        calcularIK();
    end

    function mostrarAlcance()
        set(hAlc3, 'Visible', ternario(cbAlc.Value, 'on', 'off'));
    end

    function vistaDefecto()
        view(ax3, 38, 24);
    end

    % ----- reproduccion de la mision -----
    function reproducir(~, ~)
        if reproduciendo, return; end
        if tPlay >= REF.t(end) - 1e-6, reiniciar(); end
        herr = 1;  ddHerr.Value = nombresHerr{1};
        reproduciendo = true;  bPlay.Enable = 'off';
        tgDer.SelectedTab = t3D;
        t0 = tic;  tIni = tPlay;
        while reproduciendo && isvalid(fig)
            tPlay = min(tIni + toc(t0) * vel, REF.t(end));
            mostrarInstante(tPlay);
            drawnow limitrate;
            if tPlay >= REF.t(end), reproduciendo = false; end
        end
        if isvalid(fig), bPlay.Enable = 'on'; end
    end

    function pausar()
        reproduciendo = false;
    end

    function reiniciar()
        reproduciendo = false;
        tPlay = 0;
        set(hTinta3, 'XData', nan, 'YData', nan, 'ZData', nan);
        set(hTinta2, 'XData', nan, 'YData', nan);
        mostrarInstante(0);
    end

    function cambiarVel(src, ~)
        vel = str2double(erase(src.Value, 'x'));
        tIni = tPlay;  t0 = tic;
    end

    function moverTiempo(~, ev)
        reproduciendo = false;
        tPlay = ev.Value;
        mostrarInstante(tPlay);
    end

    function mostrarInstante(t)
        k = find(REF.t <= t, 1, 'last');
        qn = interp1(REF.t, REF.q, t);
        ln = interp1(REF.t, REF.lev, t);
        ponerPose(qn, ln);
        sel = REF.fase(1:k) == 7 & REF.punta(1:k, 3) < 0.5;
        if any(sel)
            xs = REF.punta(sel, 1);  ys = REF.punta(sel, 2);
            set(hTinta3, 'XData', xs, 'YData', ys, 'ZData', 0.25 * ones(size(xs)));
            set(hTinta2, 'XData', xs, 'YData', ys);
        else
            set(hTinta3, 'XData', nan, 'YData', nan, 'ZData', nan);
            set(hTinta2, 'XData', nan, 'YData', nan);
        end
        slTiempo.Value = t;
        hCurA.Value = t;  hCurB.Value = t;
        if t <= REF.t_ini_trazo
            hCurE.Value = 0;
        elseif t >= REF.t_fin_trazo
            hCurE.Value = E.s(end);
        else
            hCurE.Value = interp1([REF.t_ini_trazo REF.t_fin_trazo], [0 E.s(end)], t);
        end
        actualizarEstado(k);
    end

    function actualizarEstado(k)
        f = REF.fase(k);
        p = mathbot_fk(q, lev, P, herr);
        lblEst.Text = { ...
            sprintf('t = %6.2f / %.2f s   (%s)', REF.t(k), REF.t(end), ddVel.Value), ...
            sprintf('Fase %d/10: %s', f, REF.nombres{f}), ...
            sprintf('theta1 %7.2f  theta2 %7.2f  phi %7.2f deg  Z %6.1f mm', q), ...
            sprintf('Punta (%7.2f, %7.2f, %6.2f) mm   plumon %s', p, ternario(lev < 1, 'ABAJO', 'arriba'))};
    end
end

function r = ternario(c, a, b)
if c, r = a; else, r = b; end
end
