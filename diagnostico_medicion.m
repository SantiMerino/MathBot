%% ========================================================================
%  MATHBOT - Diagnostico de la referencia fisica
%  ========================================================================
%  Responde una sola pregunta: con los puntos que ya se midieron se alcanza
%  el objetivo de 5 % de error, o hay que volver al carton.
%
%  La respuesta depende de como este repartido el residual:
%    - error de ESCALA     -> se corrige con una constante, no hay que remedir
%    - error SISTEMATICO   -> remedir igual da el mismo resultado
%    - error ALEATORIO     -> remedir con mas cuidado si baja el error
%
%  Requiere:  trayectoria_brazo.csv
%% ========================================================================

clear; clc;

CSV      = 'trayectoria_brazo.csv';
OBJETIVO = 0.05;      % 5 % de error maximo sobre Rmax
NP       = 200;       % puntos por tramo

T = readtable(CSV);
P = [T.X_cm, T.Y_cm];
N = size(P,1);

fprintf('====================================================================\n');
fprintf('MATHBOT · diagnostico de la referencia fisica\n');
fprintf('====================================================================\n');
fprintf('archivo : %s\npuntos  : %d\n', CSV, N);

%% ---- 1. Ruido del trazado ---------------------------------------------
paso   = hypot(diff(P(:,1)), diff(P(:,2)));
jitter = hypot(diff(P(:,1),2), diff(P(:,2),2));
ruido  = median(jitter)*10;

fprintf('\npaso entre puntos  : mediana %.3f mm\n', median(paso)*10);
fprintf('ruido punto a punto: mediana %.4f mm, p99 %.4f mm\n', ...
        ruido, pctl(jitter,99)*10);

%% ---- 2. Ajuste libre de forma -----------------------------------------
obj = @(p) sum(residual(p(1), p(2), P).^2);
p   = fminsearch(obj, [9.0 1.33], optimset('TolX',1e-7,'TolFun',1e-11, ...
                                           'MaxIter',20000,'MaxFunEvals',20000));
A = p(1); k = p(2);

[d, ds, Rmax] = residual(A, k, P);
rms_ = sqrt(mean(d.^2));
dmax = max(d);

fprintf('--------------------------------------------------------------------\n');
fprintf('AJUSTE LIBRE DE FORMA\n');
fprintf('--------------------------------------------------------------------\n');
fprintf('A = %.4f cm     k = %.4f\n', A, k);
fprintf('RMS  %6.3f mm   (%5.2f %% de Rmax)\n', rms_*10, 100*rms_/Rmax);
fprintf('Max  %6.3f mm   (%5.2f %% de Rmax)\n', dmax*10, 100*dmax/Rmax);

nom = {'petalo -X','petalo Q1','petalo Q4'};
fprintf('\npor tramo:\n');
peor = 1; vpeor = 0;
for j = 1:3
    s  = (j-1)*NP+1 : j*NP;
    dj = d(s);
    if max(dj) > vpeor, vpeor = max(dj); peor = j; end
    fprintf('  %-12s RMS %6.3f mm   Max %6.3f mm   (%5.2f %%)\n', ...
            nom{j}, sqrt(mean(dj.^2))*10, max(dj)*10, 100*max(dj)/Rmax);
end

%% ---- 3. Descomposicion del error --------------------------------------
w         = 25;
tendencia = movmean(ds, w);
aleatorio = ds - tendencia;
frac_sis  = var(tendencia) / (var(tendencia) + var(aleatorio));
cambios   = sum(diff(sign(ds)) ~= 0);
racha     = N / max(cambios,1);

fprintf('--------------------------------------------------------------------\n');
fprintf('DESCOMPOSICION DEL ERROR\n');
fprintf('--------------------------------------------------------------------\n');
fprintf('componente sistematica : %5.1f %% de la varianza\n', 100*frac_sis);
fprintf('componente aleatoria   : %5.1f %% de la varianza\n', 100*(1-frac_sis));
fprintf('racha media de signo   : %.1f puntos consecutivos\n', racha);
fprintf('ruido del trazado      : %.4f mm  (%.2f %% del error maximo)\n', ...
        ruido, 100*ruido/(dmax*10));

%% ---- 4. Escala --------------------------------------------------------
punta_chica  = max(hypot(P(1:NP,1), P(1:NP,2)));
punta_grande = max(hypot(P(:,1), P(:,2)));

fprintf('--------------------------------------------------------------------\n');
fprintf('ESCALA\n');
fprintf('--------------------------------------------------------------------\n');
fprintf('punta del petalo pequeno : %.3f cm\n', punta_chica);
fprintf('punta de los grandes     : %.3f cm\n', punta_grande);
fprintf('razon entre petalos      : %.4f\n', punta_grande/punta_chica);
fprintf('  compara estos dos numeros con la regla sobre el carton.\n');
fprintf('  si difieren por un factor comun, es escala y se corrige solo.\n');

%% ---- 5. Veredicto -----------------------------------------------------
fprintf('====================================================================\n');
fprintf('VEREDICTO\n');
fprintf('====================================================================\n');

if dmax/Rmax <= OBJETIVO
    fprintf('El error maximo (%.2f %%) ya cumple el objetivo de %.0f %%.\n', ...
            100*dmax/Rmax, 100*OBJETIVO);
    fprintf('No hace falta repetir la medicion completa.\n');
else
    fprintf('El error maximo (%.2f %%) supera el objetivo de %.0f %%.\n', ...
            100*dmax/Rmax, 100*OBJETIVO);
end

if frac_sis > 0.80
    fprintf('\nEl residual es sistematico, no ruido de medicion.\n');
    fprintf('Repetir los puntos con el mismo metodo reproduce el mismo error.\n');
    fprintf('Lo que corresponde:\n');
    fprintf('  1. revisar el tramo con mayor residual (%s)\n', nom{peor});
    fprintf('  2. verificar la calibracion de escala contra la regla\n');
    fprintf('  3. si el trazo fisico confirma la desviacion, reportarla\n');
    fprintf('     como limitacion de la referencia, no del modelo\n');
else
    fprintf('\nEl residual tiene componente aleatoria apreciable.\n');
    fprintf('Volver a medir con mas puntos y promediar si baja el error.\n');
end

fprintf('\nEl error del modelo es %.0f veces el ruido del trazado. ', ...
        rms_*10/max(ruido,1e-9));
fprintf('Mas puntos no bajan de ese piso.\n');
fprintf('====================================================================\n');

%% ---- Figura de apoyo --------------------------------------------------
figure('Color','w','Position',[80 80 900 520]);
subplot(2,1,1); hold on; grid on
plot(ds*10, '.', 'Color', [0.62 0.68 0.73], 'MarkerSize', 6);
plot(tendencia*10, 'LineWidth', 2, 'Color', [0.086 0.212 0.769]);
yline(0,'k-'); xline(NP+0.5,':'); xline(2*NP+0.5,':');
ylabel('residual con signo (mm)'); xlim([0 N+1]);
title('Residual con signo y su tendencia local');
legend({'residual','tendencia'},'Location','best'); legend boxoff

subplot(2,1,2); hold on; grid on
plot(aleatorio*10, '.', 'Color', [0.706 0.204 0.102], 'MarkerSize', 6);
yline(0,'k-'); xline(NP+0.5,':'); xline(2*NP+0.5,':');
yline( ruido, 'LineStyle','--', 'Color',[0.086 0.212 0.769], 'LineWidth',1.3, ...
      'Label', sprintf('ruido real de la digitalizacion: %.3f mm', ruido));
yline(-ruido, 'LineStyle','--', 'Color',[0.086 0.212 0.769], 'LineWidth',1.3);
xlabel('indice del punto'); ylabel('residuo de alta frecuencia (mm)');
title(sprintf(['Lo que queda tras quitar la tendencia  ·  %.1f %% de la varianza  ·  ' ...
               'sigue siendo estructura, no ruido'], 100*(1-frac_sis)));
xlim([0 N+1]);

%% ========================================================================
function v = pctl(x, p)
% percentil sin Statistics Toolbox
    y = sort(x(:));
    v = interp1(linspace(0,100,numel(y)), y, p, 'linear');
end

function [d, ds, Rmax] = residual(A, k, P)
    m = 6000;
    t = linspace(0, pi, m);
    r = -A*cos(3*t);
    C = [ (r.*cos(t))', (k*r.*sin(t))' ];
    Rmax = max(hypot(C(:,1), C(:,2)));

    % Signo del residual: de que lado de la curva cae el punto.
    % Se decide con el producto cruzado contra la tangente y no comparando
    % radios. El criterio por radio se rompe en los pasos por el origen,
    % donde el radio del punto y el de la curva son ambos casi cero y el
    % signo se voltea por ruido numerico; eso metia saltos de hasta 2 mm
    % entre puntos vecinos que no existen en la medicion.
    T = [gradient(C(:,1)), gradient(C(:,2))];
    T = T ./ hypot(T(:,1), T(:,2));

    n = size(P,1);
    d = zeros(n,1); ds = zeros(n,1);
    for i = 1:n
        [dm, j] = min(hypot(C(:,1)-P(i,1), C(:,2)-P(i,2)));
        v     = P(i,:) - C(j,:);
        d(i)  = dm;
        ds(i) = dm * sign(T(j,1)*v(2) - T(j,2)*v(1));
    end
end
