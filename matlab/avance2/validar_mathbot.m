%% VALIDAR_MATHBOT
% Paso 3. Compara la trayectoria DESEADA (ecuacion parametrica) con la EJECUTADA en la simulacion.
%
% Medida de error: e = distancia minima de cada punto ejecutado por la punta del plumon a la curva
% deseada (mm). Se reportan el maximo, el RMS y el promedio, el error en los puntos del trazo (solo por
% redondear a pasos enteros), el error de altura y el inicio/fin del trazo.
% Precision (criterio del PBL, >= 90 %):  100 * (1 - e_max / L_ref),  L_ref = radio maximo de la rosa.
%
% Ademas: analisis de sensibilidad al largo de los tramos (SEG_MM) con y sin pasos enteros.
%
% Opcional, si construyeron el modelo de Simscape (ver LEEME):  USAR_SIMSCAPE = true; validar_mathbot
% simula mathbot_sim y compara tambien la punta medida por el Transform Sensor.
% No requiere toolboxes (salvo la parte opcional de Simscape).

P = mathbot_parametros();
if exist('referencia_mathbot.mat', 'file') ~= 2, trayectoria_mathbot; end
load('referencia_mathbot.mat');

%% 1. Error de trayectoria en el trazo
E = mathbot_error_trazo(REF.P, true, 20);
enTrazo = REF.t >= REF.t_ini_trazo & REF.t <= REF.t_fin_trazo;
eZ = abs(REF.punta(enTrazo, 3));
[xi, yi] = mathbot_rosa(P.t0, P, true);
[xf, yf] = mathbot_rosa(P.t1, P, true);
pIni = E.ej(1, :);                           % punta ejecutada en el primer y ultimo punto del trazo
pFin = E.ej(end, :);

fprintf('\n=== VALIDACION MATHBOT: deseada vs ejecutada (mm) ===\n');
fprintf('Puntos ejecutados evaluados: %d (%d tramos de <= %.1f mm, 20 muestras por tramo)\n', ...
        numel(E.e), size(E.wp, 1) - 1, P.seg_mm);
fprintf('[1] Error de trayectoria XY:   max %.4f | RMS %.4f | medio %.4f mm\n', E.emax, E.erms, E.emed);
fprintf('[2] Error en los puntos del trazo (redondeo a pasos): max %.4f mm\n', max(E.ewp));
fprintf('[3] Error de altura de la punta durante el trazo:     max %.4f mm\n', max(eZ));
fprintf('[4] Inicio: ejecutado (%.2f, %.2f) vs deseado (%.2f, %.2f) -> %.4f mm\n', pIni, xi, yi, hypot(pIni(1)-xi, pIni(2)-yi));
fprintf('    Fin:    ejecutado (%.2f, %.2f) vs deseado (%.2f, %.2f) -> %.4f mm\n', pFin, xf, yf, hypot(pFin(1)-xf, pFin(2)-yf));
fprintf('[5] Precision del trazo simulado: %.3f %% (L_ref = %.1f mm; criterio del PBL >= 90 %%)\n', E.precision, E.Lref);
fprintf('    RESULTADO (tolerancia %.2f mm): %s\n', P.tol_mm, ternario(E.emax <= P.tol_mm, 'CUMPLE', 'NO CUMPLE'));

%% 2. Sensibilidad al largo de los tramos
segs = [0.5 1 2 5 10];
eSeg = zeros(numel(segs), 2);
for i = 1:numel(segs)
    Ps = REF.P;  Ps.seg_mm = segs(i);
    eSeg(i, 1) = getfield(mathbot_error_trazo(Ps, false, 20), 'emax'); %#ok<GFLD>
    eSeg(i, 2) = getfield(mathbot_error_trazo(Ps, true, 20), 'emax');  %#ok<GFLD>
end
fprintf('[6] Error max segun el largo de los tramos (firmware: %.1f mm)\n', P.seg_mm);
fprintf('    tramo (mm)   solo geometria   con pasos enteros\n');
for i = 1:numel(segs)
    fprintf('    %8.1f   %12.4f   %15.4f\n', segs(i), eSeg(i, 1), eSeg(i, 2));
end
fprintf(['    Con tramos de 1 mm domina el redondeo a pasos (%.3f mm); con tramos largos domina la cuerda: ' ...
         'el robot corta la curva entre puntos.\n'], eSeg(segs == 1, 2));

%% 3. Simscape (opcional)
hayS = exist('USAR_SIMSCAPE', 'var') && USAR_SIMSCAPE;
if hayS
    fprintf('Simulando %s (T_sim = %.2f s)...\n', P.modelo, T_sim);
    out = sim(P.modelo);
    tcp = out.get('tcp_sim');
    if isa(tcp, 'timeseries')
        ts = tcp.Time;  Xs = squeeze(tcp.Data);
    else
        ts = tcp.time;  Xs = tcp.signals.values;
    end
    if size(Xs, 2) ~= 3 && size(Xs, 1) == 3, Xs = Xs.'; end
    ts = ts(:);
    if max(abs(Xs(:))) < 5, Xs = Xs * 1000; end      % el sensor entrego metros
    sel = ts >= REF.t_ini_trazo + 0.05 & ts <= REF.t_fin_trazo - 0.05;
    D = E.deseada;  nD = size(D, 1);
    eS = zeros(sum(sel), 1);  XsT = Xs(sel, :);
    for n = 1:size(XsT, 1)
        % vertice mas cercano de la curva densa y distancia a los dos segmentos que lo tocan
        [~, i0] = min(hypot(D(:, 1) - XsT(n, 1), D(:, 2) - XsT(n, 2)));
        eS(n) = inf;
        for i1 = [max(1, i0-1), i0]
            a = D(i1, :);  b = D(min(nD, i1+1), :);  ab = b - a;
            u = min(max(dot(XsT(n, 1:2) - a, ab) / max(dot(ab, ab), eps), 0), 1);
            eS(n) = min(eS(n), norm(XsT(n, 1:2) - (a + u * ab)));
        end
    end
    Xref = interp1(REF.t, REF.punta, min(max(ts, REF.t(1)), REF.t(end)));
    eT = sqrt(sum((Xs - Xref).^2, 2));
    fprintf('[7] Simscape: punta del Transform Sensor vs curva deseada: max %.4f | RMS %.4f mm\n', max(eS), sqrt(mean(eS.^2)));
    fprintf('    Simscape vs referencia en el tiempo (incluye el retardo del filtro): max %.4f mm\n', max(eT));
end

VAL = struct('E', E, 'segs', segs, 'eSeg', eSeg, 'eZ', max(eZ));
save('resultados_validacion.mat', 'VAL');

%% 4. Figuras
if P.graficar
    f = mathbot_figura('Name', 'MATHBOT - validacion', 'Color', 'w', 'Position', [70 70 1250 520]);
    subplot(2, 3, [1 4]); hold on; axis equal; grid on; box on;
    plot(E.deseada(:, 1), E.deseada(:, 2), '-', 'Color', [.85 .2 .2], 'LineWidth', 3);
    plot(E.ej(:, 1), E.ej(:, 2), '-', 'Color', P.color_tinta, 'LineWidth', 1);
    plot(xi, yi, 'o', 'MarkerFaceColor', [.1 .7 .3], 'MarkerEdgeColor', 'k', 'MarkerSize', 9);
    plot(xf, yf, 's', 'MarkerFaceColor', [.9 .3 .3], 'MarkerEdgeColor', 'k', 'MarkerSize', 7);
    if hayS, plot(Xs(sel, 1), Xs(sel, 2), '--', 'Color', [.95 .7 0], 'LineWidth', 1); end
    xlabel('x robot (mm)'); ylabel('y robot (mm)');
    leyenda = {'deseada (ecuacion)', 'ejecutada (simulacion)', 'inicio', 'fin'};
    if hayS, leyenda{end+1} = 'Simscape (sensor)'; end
    legend(leyenda, 'Location', 'southoutside', 'NumColumns', 2);
    title(sprintf('Trazo: error max %.3f mm, RMS %.3f mm', E.emax, E.erms));

    subplot(2, 3, [2 5]); hold on; axis equal; grid on; box on;
    [~, ip] = max(hypot(E.deseada(:, 1) - P.centro(1), E.deseada(:, 2) - P.centro(2)));
    c0 = E.deseada(ip, :);  w = 4;
    plot(E.deseada(:, 1), E.deseada(:, 2), '-', 'Color', [.85 .2 .2], 'LineWidth', 3);
    plot(E.ej(:, 1), E.ej(:, 2), '-', 'Color', P.color_tinta, 'LineWidth', 1.2);
    plot(E.wp(:, 1), E.wp(:, 2), 'k.', 'MarkerSize', 10);
    xlim(c0(1) + [-w w]); ylim(c0(2) + [-w w]);
    xlabel('x (mm)'); ylabel('y (mm)');
    legend({'deseada', 'ejecutada', 'puntos del trazo (1 mm)'}, 'Location', 'southoutside');
    title('Acercamiento a la punta de un petalo (8 x 8 mm)');

    subplot(2, 3, 3); plot(E.s, E.e, '-', 'Color', P.color_tinta); grid on;
    yline(P.tol_mm, 'r--', 'tolerancia', 'LabelVerticalAlignment', 'bottom'); ylim([0, 1.25 * P.tol_mm]);
    xlabel('largo de arco recorrido (mm)'); ylabel('e (mm)'); title('Error a lo largo del trazo');

    subplot(2, 3, 6); semilogy(segs, eSeg(:, 1), 'o-', segs, eSeg(:, 2), 's-', 'LineWidth', 1.3); grid on;
    xlabel('largo de tramo SEG\_MM (mm)'); ylabel('e max (mm)');
    legend({'solo geometria', 'con pasos enteros'}, 'Location', 'northwest');
    title('Sensibilidad al largo de los tramos');
    try
        exportgraphics(f, 'validacion_mathbot.png', 'Resolution', 150);
    catch
        print(f, 'validacion_mathbot.png', '-dpng', '-r150');
    end
end

%% ---------- funciones locales ----------
function r = ternario(c, a, b)
if c, r = a; else, r = b; end
end
