%% TRAYECTORIA_MATHBOT
% Paso 1. Genera la mision que se simula: la misma secuencia que ejecuta el firmware con la orden D
% (dibujarRosa en firmware/mathbot_mega/mathbot_mega.ino), arrancando y terminando en HOME:
%
%   1 reposo en HOME (plumon arriba)        6 bajar la plataforma hasta la hoja
%   2 girar J3: plumon al frente            7 trazo de la rosa (tramos rectos de 1 mm)
%   3 subir a la altura de transito          8 subir del papel y levantar el plumon
%   4 ir al inicio de la rosa                9 regreso a HOME
%   5 bajar el plumon (servo)               10 reposo final
%
% Los movimientos entre puntos son articulares con la rampa trapezoidal de AccelStepper; el trazo
% resuelve la cinematica inversa cada 1 mm, redondea cada eje a pasos enteros del motor y mueve las
% juntas en linea recta (en angulo) dentro de cada tramo, igual que puntoTrazo() del firmware. Por eso
% la trayectoria EJECUTADA difiere (poco) de la DESEADA, y validar_mathbot mide cuanto.
%
% Resultado: estructura REF y archivo referencia_mathbot.mat, con las senales para Simscape
% ref_J1, ref_JZ, ref_J2, ref_J3, ref_JP ([t, valor] en rad o m) y T_sim.
% No requiere toolboxes.

P = mathbot_parametros();
herrP = 1;                                    % plumon
zPlat = @(tip, h) tip + P.zmesa + P.CAIDA + P.DISCO + P.BAJO(h);   % zPlataforma() del firmware
zTrans = min(zPlat(P.tip_transito, 2), P.ZMAX);                    % zTransito(): con el electroiman
nombres = {'reposo en HOME', 'plumon al frente (J3)', 'subida a transito', 'ir al inicio de la rosa', ...
           'bajar el plumon', 'bajar a la hoja', 'trazo de la rosa', 'subir del papel', ...
           'regreso a HOME', 'reposo final'};

%% 1. Curva deseada (densa) y puntos del trazo como los toma el firmware
tDenso = linspace(P.t0, P.t1, 20001);
[xd, yd] = mathbot_rosa(tDenso, P, true);
rosa = [xd(:), yd(:)];
largo = sum(hypot(diff(xd), diff(yd)));

N = 4000;                                     % recorrerRosa(): 4000 muestras de t, tramos >= SEG_MM
tN = P.t0 + (P.t1 - P.t0) * (0:N) / N;
[xN, yN] = mathbot_rosa(tN, P, true);
wp = [xN(1), yN(1)];
for i = 2:N+1
    d = hypot(xN(i) - wp(end, 1), yN(i) - wp(end, 2));
    if d >= P.seg_mm || i == N+1
        wp(end+1, :) = [xN(i), yN(i)]; %#ok<SAGROW>
    end
end
[th1w, th2w, okw] = mathbot_ik(wp(:, 1), wp(:, 2), P);
if ~all(okw)
    error('MATHBOT:alcance', '%d puntos de la rosa no se alcanzan. Cambia P.centro o P.giro.', sum(~okw));
end

%% 2. Mision
cuant = @(q) round(q .* P.PASOS) ./ P.PASOS;  % el robot solo puede estar en pasos enteros
S = struct('t', 0, 'q', cuant(P.home), 'lev', P.LEVANTE, 'fase', 1);
S = esperar(S, P.t_reposo, 1, P);
q = S.q(end, :);
S = moverArticular(S, [q(1) q(2) -P.PHI(herrP) q(4)], 2, P);
q = S.q(end, :);
S = moverArticular(S, [q(1:3) zTrans], 3, P);
S = moverArticular(S, [th1w(1) th2w(1) -P.PHI(herrP) zTrans], 4, P);
S = servo(S, 0, 5, P);
q = S.q(end, :);
S = moverArticular(S, [q(1:3) zPlat(8, herrP)], 6, P);
S = moverArticular(S, [q(1:3) zPlat(0, herrP)], 6, P);
tIniTrazo = S.t(end);
[S, tw, qw] = trazar(S, wp, th1w, th2w, 7, P);
tFinTrazo = S.t(end);
q = S.q(end, :);
S = moverArticular(S, [q(1:3) zPlat(10, herrP)], 8, P);
S = servo(S, P.LEVANTE, 8, P);
S = moverArticular(S, [q(1:3) zTrans], 8, P);
S = moverArticular(S, P.home, 9, P);
S = esperar(S, P.t_reposo, 10, P);

%% 3. Remuestreo uniforme y punta ejecutada
t = (0:P.dt:S.t(end))';
if t(end) < S.t(end), t(end+1) = S.t(end); end
[tu, iu] = unique(S.t, 'last');               % los saltos de fase repiten el instante
qT   = interp1(tu, S.q(iu, :), t, 'linear');
levT = interp1(tu, S.lev(iu), t, 'linear');
faseT = interp1(tu, S.fase(iu), t, 'previous');
punta = mathbot_fk(qT, levT, P, herrP);

%% 4. Comprobaciones
enTrazo = t >= tIniTrazo & t <= tFinTrazo;
[~, sMax, sMin] = mathbot_jacobiano(th1w, th2w, P);
rTrazo = hypot(wp(:, 1), wp(:, 2));
fprintf('\n=== TRAYECTORIA MATHBOT ===\n');
fprintf('Rosa: A = %.1f mm, k = %.4f, t de %.4f*pi a %.4f*pi; centro (%.0f, %.0f) mm, giro %.0f deg\n', ...
        P.A, P.k, P.t0/pi, P.t1/pi, P.centro(1), P.centro(2), P.giro);
fprintf('Largo del trazo: %.1f mm en %d tramos (<= %.1f mm) | %.1f s a %.0f mm/s\n', ...
        largo, size(wp, 1) - 1, P.seg_mm, tFinTrazo - tIniTrazo, P.v_trazo);
fprintf('Mision completa: %.1f s (HOME -> rosa -> HOME)\n', t(end));
fprintf('Distancia de la punta al eje J1 durante el trazo: %.1f a %.1f mm (alcance %.1f a %.1f mm)\n', ...
        min(rTrazo), max(rTrazo), sqrt(P.L1^2 + (P.L2+P.R)^2 + 2*P.L1*(P.L2+P.R)*cosd(P.LIM_J)), P.L1 + P.L2 + P.R);
fprintf('Rangos articulares en el trazo: J1 %.1f a %.1f deg | J2 %.1f a %.1f deg | J3 = %.0f deg | Z = %.1f mm\n', ...
        min(th1w), max(th1w), min(th2w), max(th2w), 0 - P.PHI(herrP) + 0, zPlat(0, herrP));
fprintf('Condicion del jacobiano en el trazo: kappa max %.2f | 1 deg en una junta mueve la punta hasta %.2f mm\n', ...
        max(sMax ./ sMin), max(sMax) * pi/180);
fprintf('Resolucion: 1 paso = %.4f deg (J1), %.4f deg (J2), %.2f mm (Z)\n', 1/P.PASOS(1), 1/P.PASOS(2), 1/P.PASOS(4));
fprintf('Punta en el trazo: z entre %.3f y %.3f mm (0 = hoja)\n', min(punta(enTrazo, 3)), max(punta(enTrazo, 3)));

%% 5. Senales para Simscape (SI) y archivo
ref_J1 = [t, qT(:, 1) * pi/180];
ref_J2 = [t, qT(:, 2) * pi/180];
ref_J3 = [t, qT(:, 3) * pi/180];
ref_JZ = [t, qT(:, 4) / 1000];
ref_JP = [t, levT / 1000];
T_sim  = t(end);

REF = struct();
REF.t = t;                    % s
REF.q = qT;                   % [theta1 theta2 phi (deg), z plataforma (mm)]
REF.lev = levT;               % mm, levante del plumon
REF.fase = faseT;             % numero de fase (ver REF.nombres)
REF.nombres = nombres;
REF.punta = punta;            % mm, punta del plumon ejecutada (marco del robot)
REF.rosa = rosa;              % mm, curva deseada densa (marco del robot)
REF.waypoints = wp;           % mm, puntos del trazo que pide el firmware
REF.tw = tw;                  % s, instante en que se llega a cada punto del trazo
REF.qw = qw;                  % deg, [theta1 theta2] en pasos enteros en cada punto del trazo
REF.t_ini_trazo = tIniTrazo;
REF.t_fin_trazo = tFinTrazo;
REF.largo = largo;
REF.P = P;
save('referencia_mathbot.mat', 'REF', 'ref_J1', 'ref_J2', 'ref_J3', 'ref_JZ', 'ref_JP', 'T_sim');
fprintf('Guardado referencia_mathbot.mat (%d muestras, T_sim = %.2f s)\n\n', numel(t), T_sim);

%% 6. Figura de control
if P.graficar
    mathbot_figura('Name', 'MATHBOT - mision', 'Color', 'w', 'Position', [80 80 1150 480]);
    subplot(1, 2, 1); hold on; axis equal; grid on; box on;
    a = linspace(0, 2*pi, 361);
    Le = P.L2 + P.R;
    rmin = sqrt(P.L1^2 + Le^2 + 2*P.L1*Le*cosd(P.LIM_J));
    hL = gobjects(6, 1);
    hL(1) = plot((P.L1 + Le) * cos(a), (P.L1 + Le) * sin(a), ':', 'Color', [.5 .5 .5]);
    hL(2) = plot(rmin * cos(a), rmin * sin(a), ':', 'Color', [.5 .5 .5]);
    rectangle('Position', [P.BASE(1), P.BASE(3), P.BASE(2)-P.BASE(1), P.BASE(4)-P.BASE(3)], 'FaceColor', [.15 .15 .17]);
    rectangle('Position', [P.CAJA(1), P.CAJA(3), P.CAJA(2)-P.CAJA(1), P.CAJA(4)-P.CAJA(3)], 'FaceColor', [.3 .3 .32]);
    hL(3) = plot(rosa(:, 1), rosa(:, 2), '-', 'Color', [.85 .2 .2], 'LineWidth', 2);
    mov = ~enTrazo;
    hL(4) = plot(punta(mov, 1), punta(mov, 2), '.', 'Color', [.6 .6 .6], 'MarkerSize', 3);
    hL(5) = plot(wp(1, 1), wp(1, 2), 'o', 'MarkerFaceColor', [.1 .7 .3], 'MarkerEdgeColor', 'k', 'MarkerSize', 8);
    hL(6) = plot(punta(1, 1), punta(1, 2), 's', 'MarkerFaceColor', [.95 .75 .1], 'MarkerEdgeColor', 'k', 'MarkerSize', 8);
    for ii = round(linspace(find(enTrazo, 1), find(enTrazo, 1, 'last'), 6))
        [pp, j2, j3] = mathbot_fk(qT(ii, :), levT(ii), P);
        plot([0 j2(1) j3(1) pp(1)], [0 j2(2) j3(2) pp(2)], '-o', 'Color', [.15 .15 .17], 'LineWidth', 1.4, 'MarkerSize', 4);
    end
    xlabel('x robot (mm)'); ylabel('y robot (mm)');
    legend(hL, {'alcance max', 'alcance min', 'rosa deseada', 'movimientos', 'inicio del trazo', 'HOME (punta)'}, ...
           'Location', 'southoutside', 'NumColumns', 3);
    title('Vista superior: mision y espacio de trabajo');
    subplot(1, 2, 2); hold on; grid on; box on;
    yyaxis left;  hA = plot(t, qT(:, 1), '-', t, qT(:, 2), '-', t, qT(:, 3), '-', 'LineWidth', 1.2); ylabel('angulo (deg)');
    yyaxis right; hZ = plot(t, qT(:, 4), '-', 'LineWidth', 1.2); ylabel('z plataforma (mm)');
    xline(tIniTrazo, 'k--'); xline(tFinTrazo, 'k--');
    xlabel('t (s)'); legend([hA; hZ], {'\theta_1', '\theta_2', '\phi (J3)', 'z'}, 'Location', 'best');
    title('Referencias articulares');
end

%% ---------- funciones locales ----------
function S = agregar(S, tRel, q, lev, fase)
% agrega muestras con tiempos relativos al final de S (tRel(1) = 0 coincide con el ultimo instante)
t0 = S.t(end);
S.t    = [S.t; t0 + tRel(:)];
S.q    = [S.q; q];
S.lev  = [S.lev; lev(:)];
S.fase = [S.fase; fase * ones(numel(tRel), 1)];
end

function S = esperar(S, T, fase, P)
n = max(2, ceil(T / P.dt) + 1);
tRel = linspace(0, T, n)';
S = agregar(S, tRel, repmat(S.q(end, :), n, 1), S.lev(end) * ones(n, 1), fase);
end

function S = servo(S, levFin, fase, P)
% el servo lleva el plumon de su posicion actual a levFin con un perfil suave
n = max(2, ceil(P.t_servo / P.dt) + 1);
tRel = linspace(0, P.t_servo, n)';
u = (1 - cos(pi * tRel / P.t_servo)) / 2;
lev = S.lev(end) + (levFin - S.lev(end)) * u;
S = agregar(S, tRel, repmat(S.q(end, :), n, 1), lev, fase);
end

function S = moverArticular(S, qFin, fase, P)
% moverArticular() del firmware: todos los ejes salen y llegan juntos; el eje mas lento manda,
% con rampa trapezoidal (VMAX, ACEL en pasos); los demas se escalan en proporcion.
q0 = S.q(end, :);
qFin = round(qFin .* P.PASOS) ./ P.PASOS;
d = abs(qFin - q0) .* P.PASOS;                % pasos de cada eje
[tMax, ref] = max(d ./ P.VMAX);
if tMax <= 0, return; end
[T, frac] = perfilTrapecio(d(ref), P.VMAX(ref), P.ACEL(ref));
n = max(2, ceil(T / P.dt) + 1);
tRel = linspace(0, T, n)';
f = frac(tRel);
q = q0 + (qFin - q0) .* f;
S = agregar(S, tRel, q, S.lev(end) * ones(n, 1), fase);
end

function [T, frac] = perfilTrapecio(d, v, a)
% fraccion recorrida (0..1) de un perfil trapezoidal (o triangular si no alcanza v)
if d >= v^2 / a
    ta = v / a;  T = d / v + ta;
    frac = @(t) min(max(( (t < ta) .* (0.5*a*t.^2) + ...
        (t >= ta & t < T - ta) .* (v^2/(2*a) + v*(t - ta)) + ...
        (t >= T - ta) .* (d - 0.5*a*(T - t).^2) ) / d, 0), 1);
else
    tp = sqrt(d / a);  T = 2 * tp;
    frac = @(t) min(max(( (t < tp) .* (0.5*a*t.^2) + ...
        (t >= tp) .* (d - 0.5*a*(T - t).^2) ) / d, 0), 1);
end
end

function [S, tw, qw] = trazar(S, wp, th1w, th2w, fase, P)
% puntoTrazo(): cada tramo dura largo/v; J1 y J2 van a velocidad constante hasta sus pasos enteros
q0 = S.q(end, :);
qw = round([th1w(:), th2w(:)] .* P.PASOS(1:2)) ./ P.PASOS(1:2);
dur = max(hypot(diff(wp(:, 1)), diff(wp(:, 2))) / P.v_trazo, 0.002);
twRel = [0; cumsum(dur)];
tw = S.t(end) + twRel;
tRel = unique([(0:P.dt:twRel(end))'; twRel]);
qq = interp1(twRel, qw, tRel, 'linear');
q = [qq, repmat(q0(3:4), numel(tRel), 1)];
q(1, :) = q0;                                 % el robot ya esta en el inicio (mismos pasos)
S = agregar(S, tRel, q, S.lev(end) * ones(numel(tRel), 1), fase);
end
