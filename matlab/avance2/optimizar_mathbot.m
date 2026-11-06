%% OPTIMIZAR_MATHBOT
% Paso 2. Mejora del diseno con calculo multivariable: donde colocar la rosa respecto al robot.
%
% Que se mejora: la sensibilidad de la punta a los errores de las juntas. Un error pequeno dtheta en
% las juntas mueve la punta  dp = J(theta) dtheta  (linealizacion con el jacobiano). El peor caso es
% |dp| <= sigma_max(J) |dtheta| y la "forma" del error la da la condicion kappa = sigma_max / sigma_min:
% con kappa alto el robot es preciso en una direccion y torpe en la otra (cerca de una singularidad).
%
% Variables de diseno: centro de la rosa (cx, cy) y giro alfa.
% Objetivo:  minimizar  f(cx, cy, alfa) = max_t kappa(J(theta(t)))   a lo largo de todo el trazo
% Restricciones:
%   - cada punto alcanzable con |theta1|, |theta2| <= 150 deg (finales de carrera)
%   - |theta2| <= 140 deg (margen de 10 deg al final de carrera de J2)
%   - la curva a >= 140 mm del eje J1 y fuera de la base y de la caja del Arduino
% Metodo: barrido en (cx, alfa) con cy = 0 (mapa completo del problema) y refinamiento con
% fminsearch (Nelder-Mead, sin derivadas) sobre (cx, cy, alfa) con penalizacion de las restricciones.
% Compara ANTES (primera idea: rosa en el centro del anillo de alcance, sin girar) y DESPUES.
% No requiere toolboxes.

P = mathbot_parametros();
TH2_MAX = 140;  R_MIN = 140;
antes   = struct('centro', [260 0], 'giro', 0, 'nombre', 'Antes: centro del anillo de alcance, sin girar');
despues = struct('centro', P.centro, 'giro', P.giro, 'nombre', 'Despues: ubicacion optimizada (firmware)');

%% 1. Barrido (cy = 0)
alfas = 0:15:345;
Ds = 120:5:340;
KAP = nan(numel(alfas), numel(Ds));
for i = 1:numel(alfas)
    for j = 1:numel(Ds)
        M = evaluarUbicacion(P, [Ds(j) 0], alfas(i), TH2_MAX, R_MIN);
        if M.factible, KAP(i, j) = M.kmax; end
    end
end
[kBar, imin] = min(KAP(:));
[ib, jb] = ind2sub(size(KAP), imin);
fprintf('\n=== OPTIMIZACION DE LA UBICACION DE LA ROSA ===\n');
fprintf('Barrido: %d ubicaciones, %d factibles. Mejor: centro (%d, 0) mm, giro %d deg -> kappa max %.3f\n', ...
        numel(KAP), sum(~isnan(KAP(:))), Ds(jb), alfas(ib), kBar);

%% 2. Refinamiento continuo (cx, cy, alfa)
opt = optimset('Display', 'off', 'TolX', 1e-3, 'TolFun', 1e-5, 'MaxFunEvals', 4000, 'MaxIter', 2000);
x0 = [Ds(jb), 0, alfas(ib)];
xopt = fminsearch(@(x) objetivo(P, x, TH2_MAX, R_MIN), x0, opt);
Mopt = evaluarUbicacion(P, xopt(1:2), xopt(3), TH2_MAX, R_MIN);
fprintf('fminsearch: centro (%.1f, %.1f) mm, giro %.1f deg -> kappa max %.3f (factible: %d)\n', ...
        xopt(1), xopt(2), xopt(3), Mopt.kmax, Mopt.factible);
fprintf('Restriccion activa en el optimo: |theta2| max = %.1f deg (limite %d)\n', max(abs(Mopt.th2)), TH2_MAX);
fprintf('Se usa la ubicacion redondeada del firmware: centro (%.0f, %.0f), giro %.0f deg.\n', P.centro, P.giro);

%% 3. Antes vs despues
casos = {antes, despues};
T = cell(2, 1);
for c = 1:2
    Pc = P;  Pc.centro = casos{c}.centro;  Pc.giro = casos{c}.giro;
    M = evaluarUbicacion(Pc, Pc.centro, Pc.giro, TH2_MAX, R_MIN);
    E = mathbot_error_trazo(Pc, true);
    T{c} = struct('M', M, 'E', E, 'P', Pc);
end
fprintf('\n%-34s %14s %14s %10s\n', 'Indicador', 'Antes', 'Despues', 'Cambio');
fila = @(nombre, a, b, fmt) fprintf(['%-34s ' fmt ' ' fmt ' %9.1f%%\n'], nombre, a, b, 100 * (b - a) / a);
fila('kappa max (condicion)', T{1}.M.kmax, T{2}.M.kmax, '%14.3f');
fila('kappa medio', mean(T{1}.M.kap), mean(T{2}.M.kap), '%14.3f');
fila('mm de punta por 1 deg (peor caso)', T{1}.M.smax * pi/180, T{2}.M.smax * pi/180, '%14.3f');
fila('mm de punta por 1 deg (medio)', mean(T{1}.M.sig) * pi/180, mean(T{2}.M.sig) * pi/180, '%14.3f');
fila('error ejecutado max (mm)', T{1}.E.emax, T{2}.E.emax, '%14.4f');
fila('error ejecutado RMS (mm)', T{1}.E.erms, T{2}.E.erms, '%14.4f');
fprintf('%-34s %14s %14s\n', 'rango theta2 (deg)', sprintf('%.1f a %.1f', min(T{1}.M.th2), max(T{1}.M.th2)), ...
        sprintf('%.1f a %.1f', min(T{2}.M.th2), max(T{2}.M.th2)));
fprintf('%-34s %14.1f %14.1f\n', 'distancia minima a J1 (mm)', T{1}.M.rmin, T{2}.M.rmin);
fprintf(['Lectura: con la ubicacion optimizada, una holgura de 1 deg en las poleas mueve la punta a lo sumo ' ...
         '%.2f mm (antes %.2f mm).\n\n'], T{2}.M.smax * pi/180, T{1}.M.smax * pi/180);

OPT = struct('alfas', alfas, 'Ds', Ds, 'KAP', KAP, 'xopt', xopt, 'antes', T{1}, 'despues', T{2});
save('resultados_optimizacion.mat', 'OPT');

%% 4. Figuras
if P.graficar
    mathbot_figura('Name', 'MATHBOT - optimizacion', 'Color', 'w', 'Position', [60 60 1250 430]);
    subplot(1, 3, 1);
    imagesc(Ds, alfas, KAP, 'AlphaData', double(~isnan(KAP))); axis xy; colormap(gca, parula); cb = colorbar;
    cb.Label.String = '\kappa max en el trazo';
    caxis([kBar, max(kBar + 0.5, min(6, max(KAP(:))))]);   % escala util: del optimo a kappa = 6
    hold on;
    hA = plot(antes.centro(1), antes.giro, 'wo', 'MarkerFaceColor', [.85 .2 .2], 'MarkerSize', 9);
    hD = plot(P.centro(1), P.giro, 'wp', 'MarkerFaceColor', [.1 .7 .3], 'MarkerSize', 14);
    xlabel('c_x: distancia del centro de la rosa a J1 (mm)'); ylabel('\alpha: giro de la rosa (deg)');
    title('Mapa del objetivo (blanco = no factible)');
    legend([hA, hD], {'antes', 'despues'}, 'Location', 'southoutside', 'NumColumns', 2);

    subplot(1, 3, 2); hold on; axis equal; grid on; box on;
    a = linspace(0, 2*pi, 361);  Le = P.L2 + P.R;
    hU = gobjects(4, 1);
    hU(1) = plot((P.L1 + Le) * cos(a), (P.L1 + Le) * sin(a), ':', 'Color', [.5 .5 .5]);
    hU(2) = plot(R_MIN * cos(a), R_MIN * sin(a), '--', 'Color', [.6 .6 .6]);
    rectangle('Position', [P.BASE(1), P.BASE(3), P.BASE(2)-P.BASE(1), P.BASE(4)-P.BASE(3)], 'FaceColor', [.15 .15 .17]);
    hU(3) = plot(T{1}.E.deseada(:, 1), T{1}.E.deseada(:, 2), '-', 'Color', [.85 .2 .2], 'LineWidth', 1.6);
    hU(4) = plot(T{2}.E.deseada(:, 1), T{2}.E.deseada(:, 2), '-', 'Color', [.1 .6 .3], 'LineWidth', 1.6);
    xlabel('x robot (mm)'); ylabel('y robot (mm)');
    legend(hU, {'alcance max', 'r = 140 mm', 'antes', 'despues'}, 'Location', 'southoutside', 'NumColumns', 2);
    title('Ubicacion de la rosa');

    subplot(1, 3, 3); hold on; grid on; box on;
    plot(linspace(0, 1, numel(T{1}.M.kap)), T{1}.M.kap, '-', 'Color', [.85 .2 .2], 'LineWidth', 1.4);
    plot(linspace(0, 1, numel(T{2}.M.kap)), T{2}.M.kap, '-', 'Color', [.1 .6 .3], 'LineWidth', 1.4);
    xlabel('avance del trazo (0 = inicio, 1 = fin)'); ylabel('\kappa(J)');
    legend({sprintf('antes (max %.2f)', T{1}.M.kmax), sprintf('despues (max %.2f)', T{2}.M.kmax)}, 'Location', 'best');
    title('Condicion del jacobiano a lo largo del trazo');
end

%% ---------- funciones locales ----------
function M = evaluarUbicacion(P, centro, giro, th2max, rmin)
P.centro = centro;  P.giro = giro;
t = linspace(P.t0, P.t1, 800);
[x, y] = mathbot_rosa(t, P, true);
x = x(:);  y = y(:);
[th1, th2, ok] = mathbot_ik(x, y, P);
[~, sMax, sMin] = mathbot_jacobiano(th1, th2, P);
r = hypot(x, y);
enObst = @(B) x > B(1) & x < B(2) & y > B(3) & y < B(4);
M.th1 = th1;  M.th2 = th2;  M.ok = ok;
M.kap = sMax ./ max(sMin, eps);
M.sig = sMax;
M.kmax = max(M.kap);
M.smax = max(sMax);
M.rmin = min(r);
M.viol = sum(~ok) + max(0, max(abs(th2)) - th2max) + max(0, rmin - min(r)) + ...
         sum(enObst(P.BASE)) + sum(enObst(P.CAJA));
M.factible = M.viol == 0;
end

function f = objetivo(P, x, th2max, rmin)
M = evaluarUbicacion(P, x(1:2), x(3), th2max, rmin);
if M.factible
    f = M.kmax;
else
    f = 10 + 10 * M.viol;            % penalizacion: siempre peor que cualquier punto factible
end
end
