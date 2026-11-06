function R = mathbot_error_trazo(P, cuantizar, nsub)
%MATHBOT_ERROR_TRAZO  Trayectoria deseada vs ejecutada durante el trazo de la rosa.
%   R = mathbot_error_trazo(P)                 con pasos enteros y 20 muestras por tramo
%   R = mathbot_error_trazo(P, cuantizar, nsub)
%
%   Reproduce lo que hace el firmware: toma puntos de la rosa separados >= P.seg_mm (de 4000 muestras
%   de t), resuelve la cinematica inversa en cada uno, redondea J1 y J2 a pasos enteros (si cuantizar)
%   y mueve las juntas en linea recta (en angulo) entre puntos consecutivos. La punta EJECUTADA se
%   calcula con la cinematica directa y se compara con la curva DESEADA (la ecuacion parametrica).
%
%   Medida de error: distancia minima de cada punto ejecutado a la curva deseada (distancia punto a
%   polilinea con la curva muestreada cada ~0.07 mm). Se busca solo cerca del tramo correspondiente
%   para no confundir los tres pasos de la curva por el centro de la rosa.
%
%   R.e         distancia de cada punto ejecutado a la curva (mm)
%   R.emax, R.erms, R.emed
%   R.ewp       error en los puntos del trazo (solo por redondear a pasos), mm
%   R.ej        N x 2 puntos ejecutados (mm, marco del robot)   R.s  largo de arco de cada uno (mm)
%   R.wp        puntos del trazo pedidos                         R.qw [theta1 theta2] en esos puntos
%   R.deseada   curva deseada densa                              R.Lref radio maximo de la rosa (mm)
%   R.precision 100 * (1 - emax / Lref)   (criterio del PBL: >= 90 %)
if nargin < 2, cuantizar = true; end
if nargin < 3, nsub = 20; end

N  = 4000;                                   % recorrerRosa() del firmware
nD = 5 * N + 1;                              % curva densa: 5 muestras por cada muestra del firmware
tD = linspace(P.t0, P.t1, nD);
[xd, yd] = mathbot_rosa(tD, P, true);
tN = tD(1:5:end);
xN = xd(1:5:end);  yN = yd(1:5:end);

% puntos del trazo (tramos >= seg_mm)
keep = false(1, N + 1);  keep(1) = true;  ult = 1;
for i = 2:N+1
    if hypot(xN(i) - xN(ult), yN(i) - yN(ult)) >= P.seg_mm || i == N + 1
        keep(i) = true;  ult = i;
    end
end
iw = find(keep);
wp = [xN(iw)', yN(iw)'];
[th1, th2, ok] = mathbot_ik(wp(:, 1), wp(:, 2), P);
qw = [th1, th2];
if cuantizar
    qw = round(qw .* P.PASOS(1:2)) ./ P.PASOS(1:2);
end

% interpolacion lineal en angulo dentro de cada tramo
nS = size(wp, 1) - 1;
u  = (0:nsub-1)' / nsub;
q1 = qw(1:end-1, 1)' + u * diff(qw(:, 1))';  % nsub x nS
q2 = qw(1:end-1, 2)' + u * diff(qw(:, 2))';
q1 = [q1(:); qw(end, 1)];
q2 = [q2(:); qw(end, 2)];
seg = [kron((1:nS)', ones(nsub, 1)); nS];
n = numel(q1);
ej = mathbot_fk([q1, q2, zeros(n, 1), zeros(n, 1)], 0, P);
ej = ej(:, 1:2);

% distancia a la curva deseada, buscando cerca del tramo
iD = (iw - 1) * 5 + 1;                       % indice de cada punto del trazo en la curva densa
e = zeros(n, 1);
for s = 1:nS
    a = max(1, iD(s) - 25);  b = min(nD, iD(s+1) + 25);
    idx = find(seg == s);
    e(idx) = distPolilinea(ej(idx, :), [xd(a:b)', yd(a:b)']);
end
pw = mathbot_fk([qw, zeros(nS+1, 2)], 0, P);
ewp = hypot(pw(:, 1) - wp(:, 1), pw(:, 2) - wp(:, 2));

R = struct();
R.e = e;  R.emax = max(e);  R.erms = sqrt(mean(e.^2));  R.emed = mean(e);
R.ewp = ewp;
R.ej = ej;
R.s = [0; cumsum(hypot(diff(ej(:, 1)), diff(ej(:, 2))))];
R.wp = wp;  R.qw = qw;  R.ok = all(ok);
R.deseada = [xd(:), yd(:)];
[xl, yl] = mathbot_rosa(tD, P, false);
R.Lref = max(hypot(xl, yl));
R.precision = 100 * (1 - R.emax / R.Lref);
end

function d = distPolilinea(Q, C)
% distancia minima de cada punto de Q (m x 2) a la polilinea C (k x 2)
A = C(1:end-1, :);  B = C(2:end, :);
AB = B - A;
L2 = sum(AB.^2, 2)';  L2(L2 == 0) = eps;
qx = Q(:, 1);  qy = Q(:, 2);
t = ((qx - A(:, 1)') .* AB(:, 1)' + (qy - A(:, 2)') .* AB(:, 2)') ./ L2;
t = min(max(t, 0), 1);
px = A(:, 1)' + t .* AB(:, 1)';
py = A(:, 2)' + t .* AB(:, 2)';
d = min(sqrt((qx - px).^2 + (qy - py).^2), [], 2);
end
