%% ========================================================================
%  MATHBOT - PBL
%  Avance 1: Determinacion y validacion inicial de la trayectoria
%  Calculo III (Matematica Multivariable y Ecuaciones Diferenciales)
%
%  ARCHIVO PRINCIPAL. Genera las ocho figuras del documento de entrega y
%  las tablas de validacion contra las dos referencias independientes.
%
%  REFERENCIAS
%    1. trayectoria_brazo.csv - trazo fisico digitalizado, 600 puntos en
%       tres bloques de 200 (petalo -X, petalo Q1, petalo Q4)
%    2. wpd_datasets.csv      - la imagen del enunciado digitalizada con
%       WebPlotDigitizer, un dataset por color. Opcional: si falta, se
%       omiten las figuras 7 y 8
%
%  EJECUCION
%    1. Colocar este archivo y los dos CSV en la misma carpeta
%    2. Fijar esa carpeta como directorio de trabajo de MATLAB
%    3. Ejecutar. No requiere argumentos ni entrada del usuario
%
%  CORRESPONDENCIA CON LA NUMERACION DEL DOCUMENTO
%    La Figura 1 del documento es la imagen del enunciado y no la genera
%    MATLAB, asi que el PNG figN corresponde siempre a la Figura N+1:
%
%      fig1_modelo.png          ->  Figura 2   (seccion 8)
%      fig2_superposicion.png   ->  Figura 3   (seccion 8)
%      fig3_residuales.png      ->  Figura 4   (seccion 8)
%      fig4_por_petalo.png      ->  Figura 5   (seccion 8)
%      fig5_anisotropia.png     ->  Figura 6   (seccion 8)
%      fig6_diferencial.png     ->  Figura 7   (seccion 8)
%      fig7_dos_referencias.png ->  Figura 8   (seccion 14.6)
%      fig8_valor_k.png         ->  Figura 9   (seccion 14.6)
%
%  PARAMETROS EDITABLES: bloque 1
%  SALIDA: ocho PNG a 300 dpi en ./figuras + resumen numerico en consola
%  DEPENDENCIAS: solo MATLAB base (sin toolboxes). Requiere R2019a o
%  superior por readmatrix.
%% ========================================================================

clear; clc; close all;
outdir = 'figuras';          % carpeta de salida de los PNG
if ~exist(outdir,'dir'); mkdir(outdir); end

%% ------------------------------------------------------------------------
%  BLOQUE 1 - MODELO DECLARADO  (unicos parametros editables)
%% ------------------------------------------------------------------------
A    = 10.29;                 % amplitud base [cm]
k    = 1.3552;                % factor de estiramiento sobre el eje Y
n    = 3;                     % numero de petalos (impar)
phi  = 0;                     % fase [rad]

t0   = 5*pi/6;                % dominio declarado
t1   = 11*pi/6;

X = @(t) -A .* cos(n*(t-phi)) .* cos(t);
Y = @(t) -A .* k .* cos(n*(t-phi)) .* sin(t);

t   = linspace(t0, t1, 6000);
xm  = X(t);  ym = Y(t);
Rm  = hypot(xm, ym);
Rmax = max(Rm);

% Puntos notables: r = 0 (origen) y puntas de petalo
t_org  = [5*pi/6, 7*pi/6, 3*pi/2, 11*pi/6];
t_tip  = [pi, 4*pi/3, 5*pi/3];

%% ------------------------------------------------------------------------
%  BLOQUE 2 - REFERENCIA FISICA
%% ------------------------------------------------------------------------
T  = readtable('trayectoria_brazo.csv');
Pm = [T.X_cm, T.Y_cm];

% Recalibracion de escala. El trazo digitalizado conserva la forma pero no
% la escala: sus puntas miden 8.850 y 11.150 cm, contra 10 y 13 cm medidos
% con regla sobre el carton. El factor se estima por minimos cuadrados
% contra el modelo y se contrasta con el que se obtiene de la regla.
tf = linspace(t0, t1, 20000);
Cf = [X(tf)', Y(tf)'];              % curva fina, para los residuales finales
Cs = Cf(1:4:end, :);                % curva gruesa, para el ajuste de escala

dist_s = @(sc) sum(arrayfun(@(i) ...
    min(hypot(Cs(:,1)-sc*Pm(i,1), Cs(:,2)-sc*Pm(i,2))), 1:size(Pm,1)).^2);
s  = fminbnd(dist_s, 1.00, 1.35, optimset('TolX',1e-7));
Pc = Pm * s;

punta_negX  = max(hypot(Pm(1:200,1), Pm(1:200,2)));
punta_grande = max(hypot(Pm(:,1), Pm(:,2)));

% factor independiente, deducido solo de la regla (10 y 13 cm)
s_regla = (punta_negX*10 + 2*punta_grande*13) / (punta_negX^2 + 2*punta_grande^2);

fprintf('--- Recalibracion de la referencia ---\n');
fprintf('Factor por minimos cuadrados : %.5f\n', s);
fprintf('Factor deducido de la regla  : %.5f   (diferencia %.2f %%)\n', ...
        s_regla, 100*abs(s-s_regla)/s);
fprintf('Punta -X      cruda / corregida : %6.3f / %6.3f cm   (regla 10, modelo %.3f)\n', ...
        punta_negX, punta_negX*s, A);
fprintf('Punta grande  cruda / corregida : %6.3f / %6.3f cm   (regla 13, modelo %.3f)\n\n', ...
        punta_grande, punta_grande*s, Rmax);

%% ------------------------------------------------------------------------
%  BLOQUE 3 - RESIDUALES PUNTO A CURVA
%% ------------------------------------------------------------------------
m = size(Pc,1);
d = zeros(m,1);
for i = 1:m
    d(i) = min(hypot(Cf(:,1)-Pc(i,1), Cf(:,2)-Pc(i,2)));
end

seg = {1:200, 201:400, 401:600};
nom = {'Petalo -X', 'Petalo Q1', 'Petalo Q4'};

fprintf('--- Validacion contra la referencia fisica ---\n');
fprintf('Metrica: desviacion perpendicular normalizada por Rmax = %.3f cm\n\n', Rmax);
fprintf('%-12s %10s %10s %10s\n','Tramo','RMS (mm)','Max (mm)','Max (%%)');
for j = 1:3
    dj = d(seg{j});
    fprintf('%-12s %10.3f %10.3f %10.2f\n', nom{j}, ...
            sqrt(mean(dj.^2))*10, max(dj)*10, 100*max(dj)/Rmax);
end
fprintf('%-12s %10.3f %10.3f %10.2f\n','GLOBAL', ...
        sqrt(mean(d.^2))*10, max(d)*10, 100*max(d)/Rmax);
fprintf('\nPrecision bajo la metrica declarada: %.2f %%\n', 100*(1-max(d)/Rmax));

% Longitud de arco: comparacion independiente de la metrica anterior
dx = gradient(xm,t); dy = gradient(ym,t);
L_mod = trapz(t, hypot(dx,dy));
L_med = sum(hypot(diff(Pc(:,1)), diff(Pc(:,2))));
fprintf('Longitud de arco modelo / medida: %.2f / %.2f cm  (%.2f %% de diferencia)\n\n', ...
        L_mod, L_med, 100*abs(L_mod-L_med)/L_mod);

%% ------------------------------------------------------------------------
%  BLOQUE 4 - SEGUNDA REFERENCIA: LA IMAGEN DEL ENUNCIADO
%
%  Validacion independiente de la anterior. La curva de la Figura 1 se
%  digitalizo aparte con WebPlotDigitizer (wpd_datasets.csv, un dataset por
%  color). Esa digitalizacion quedo con el eje Y comprimido, porque la
%  figura del enunciado no trae escala numerica en los ejes y la
%  calibracion se introdujo a mano: hay que multiplicar la columna Y por
%  S_IMG antes de usarla. El factor se dedujo contrastando contra la
%  medicion directa sobre los pixeles del PDF (seccion 14.3 del documento).
%% ------------------------------------------------------------------------
S_IMG   = 1.2431;                    % correccion del eje Y de la digitalizacion
CSV_IMG = 'wpd_datasets.csv';
hay_img = isfile(CSV_IMG);

if hay_img
    Mi = readmatrix(CSV_IMG, 'NumHeaderLines', 2);
    Pi = [];
    for cc = 1:2:5
        par = Mi(:, cc:cc+1);
        par = par(all(~isnan(par), 2), :);
        Pi  = [Pi; par];                                       %#ok<AGROW>
    end
    Pi(:,2) = Pi(:,2) * S_IMG;

    % Escalar para que la punta del petalo menor coincida con A. Esa punta
    % esta sobre el eje X, donde y = 0, asi que su longitud no depende de k.
    thi = atan2d(Pi(:,2), Pi(:,1));
    ri  = hypot(Pi(:,1), Pi(:,2));
    Pi  = Pi * (A / max(ri(abs(abs(thi) - 180) < 40)));
    thi = atan2d(Pi(:,2), Pi(:,1));

    di = zeros(size(Pi,1), 1);
    for i = 1:size(Pi,1)
        di(i) = min(hypot(Cf(:,1) - Pi(i,1), Cf(:,2) - Pi(i,2)));
    end

    gi = 1*(abs(abs(thi) - 180) < 60) + 2*(thi > 0 & thi <= 120) + ...
         3*(thi < 0 & thi >= -120);

    fprintf('--- Validacion contra la imagen del enunciado (%d puntos) ---\n', size(Pi,1));
    fprintf('%-12s %10s %10s %10s\n','Tramo','RMS (mm)','Max (mm)','Max (%%)');
    for j = 1:3
        dj = di(gi == j);
        fprintf('%-12s %10.3f %10.3f %10.2f\n', nom{j}, ...
                sqrt(mean(dj.^2))*10, max(dj)*10, 100*max(dj)/Rmax);
    end
    fprintf('%-12s %10.3f %10.3f %10.2f\n','GLOBAL', ...
            sqrt(mean(di.^2))*10, max(di)*10, 100*max(di)/Rmax);
    fprintf(['\nLas dos referencias son independientes entre si: una es el trazo\n' ...
             'fisico medido con regla, la otra la imagen entregada en el enunciado.\n' ...
             'Las dos rechazan por igual una rosa simetrica (figura 8).\n\n']);
else
    warning('No se encontro %s: se omiten las figuras 7 y 8.', CSV_IMG);
end

%% ------------------------------------------------------------------------
%  ESTILO COMUN
%% ------------------------------------------------------------------------
col_mod = [0.086 0.212 0.769];
col_ref = [0.706 0.204 0.102];
col_alt = [0.059 0.608 0.235];
set(groot,'defaultAxesFontName','Helvetica','defaultAxesFontSize',11);
sv = @(f,nm) guardar(f, fullfile(outdir,[nm '.png']));

%% ------------------------------------------------------------------------
%  FIGURA 2 DEL DOCUMENTO  (fig1_modelo.png)
%  Curva del modelo, dominio y sentido de recorrido
%% ------------------------------------------------------------------------
f1 = figure('Color','w','Position',[80 80 720 700]); hold on; axis equal; grid on
plot(xm, ym, 'LineWidth', 2, 'Color', col_mod);
plot(X(t_org), Y(t_org), 'ko', 'MarkerFaceColor','w', 'MarkerSize', 8, 'LineWidth',1.4);
plot(X(t_tip), Y(t_tip), 'o', 'MarkerFaceColor', col_ref, ...
     'MarkerEdgeColor','w', 'MarkerSize', 9);

% flechas de sentido de recorrido
for tq = [0.9*pi, 1.28*pi, 1.62*pi]
    p = [X(tq) Y(tq)];
    v = [X(tq+1e-3)-X(tq-1e-3), Y(tq+1e-3)-Y(tq-1e-3)];
    v = 1.6*v/norm(v);
    quiver(p(1), p(2), v(1), v(2), 0, 'Color', col_mod, ...
           'LineWidth', 2, 'MaxHeadSize', 3);
end
text(-A-2.6, 0.7, sprintf('%.2f cm', A), 'FontSize',10);
text(X(4*pi/3)+0.5, Y(4*pi/3)+0.6, sprintf('%.2f cm', Rmax), 'FontSize',10);
xlabel('x (cm)'); ylabel('y (cm)');
title(sprintf('Trayectoria propuesta  ·  A = %.2f cm, k = %.4f, n = 3', A, k));
legend({'Modelo','r = 0 (origen)','Puntas de petalo'}, 'Location','southoutside', ...
       'Orientation','horizontal'); legend boxoff
sv(f1,'fig1_modelo');

%% ------------------------------------------------------------------------
%  FIGURA 3 DEL DOCUMENTO  (fig2_superposicion.png)
%  Superposicion del modelo sobre la referencia fisica
%% ------------------------------------------------------------------------
f2 = figure('Color','w','Position',[80 80 720 700]); hold on; axis equal; grid on
plot(Pc(:,1), Pc(:,2), '.', 'Color', col_ref, 'MarkerSize', 7);
plot(xm, ym, 'LineWidth', 1.8, 'Color', col_mod);
plot(0,0,'k+','MarkerSize',13,'LineWidth',1.4);
xlabel('x (cm)'); ylabel('y (cm)');
title('Modelo parametrico sobre el trazo fisico digitalizado');
legend({'Referencia fisica (600 puntos)','Modelo','Origen'}, ...
       'Location','southoutside','Orientation','horizontal'); legend boxoff
sv(f2,'fig2_superposicion');

%% ------------------------------------------------------------------------
%  FIGURA 4 DEL DOCUMENTO  (fig3_residuales.png)
%  Residuales punto a punto
%% ------------------------------------------------------------------------
f3 = figure('Color','w','Position',[80 80 860 460]); hold on; grid on
bar(d*10, 1, 'FaceColor',[0.62 0.68 0.73], 'EdgeColor','none');
yline(0.05*Rmax*10, '--', sprintf('Tolerancia 5 %% = %.2f mm', 0.05*Rmax*10), ...
      'Color', col_ref, 'LineWidth', 1.6, 'LabelHorizontalAlignment','left');
yline(sqrt(mean(d.^2))*10, '-', sprintf('RMS = %.2f mm', sqrt(mean(d.^2))*10), ...
      'Color', col_alt, 'LineWidth', 1.4, 'LabelHorizontalAlignment','right');
xline(200.5,':','Color',[.4 .4 .4]); xline(400.5,':','Color',[.4 .4 .4]);
text(100,max(d)*10*0.95,'petalo -X','HorizontalAlignment','center','FontSize',9);
text(300,max(d)*10*0.95,'petalo Q1','HorizontalAlignment','center','FontSize',9);
text(500,max(d)*10*0.95,'petalo Q4','HorizontalAlignment','center','FontSize',9);
xlabel('indice del punto de la referencia'); ylabel('desviacion (mm)');
title('Residuales del modelo respecto de la referencia fisica');
xlim([0 601]);
sv(f3,'fig3_residuales');

%% ------------------------------------------------------------------------
%  FIGURA 5 DEL DOCUMENTO  (fig4_por_petalo.png)
%  Error por petalo
%% ------------------------------------------------------------------------
res_rms = zeros(1,3); res_max = zeros(1,3);
for j = 1:3
    dj = d(seg{j});
    res_rms(j) = sqrt(mean(dj.^2))*10;
    res_max(j) = max(dj)*10;
end

f4 = figure('Color','w','Position',[80 80 760 460]); hold on; grid on
b = bar([res_rms; res_max]', 0.78);
b(1).FaceColor = [0.62 0.68 0.73];  b(1).EdgeColor = 'none';
b(2).FaceColor = col_mod;           b(2).EdgeColor = 'none';
yline(0.05*Rmax*10, '--', sprintf('Tolerancia 5 %% = %.2f mm', 0.05*Rmax*10), ...
      'Color', col_ref, 'LineWidth', 1.6);
set(gca,'XTick',1:3,'XTickLabel',nom);
ylabel('desviacion (mm)');
title('Error del modelo por petalo');
legend({'RMS','Maximo'},'Location','northeast'); legend boxoff
for j = 1:3
    text(j-0.19, res_rms(j)+0.18, sprintf('%.2f',res_rms(j)), ...
         'HorizontalAlignment','center','FontSize',9);
    text(j+0.19, res_max(j)+0.18, sprintf('%.2f',res_max(j)), ...
         'HorizontalAlignment','center','FontSize',9);
end
ylim([0 max(res_max)*1.28]);
sv(f4,'fig4_por_petalo');

%% ------------------------------------------------------------------------
%  FIGURA 6 DEL DOCUMENTO  (fig5_anisotropia.png)
%  Justificacion del factor de anisotropia
%% ------------------------------------------------------------------------
f5 = figure('Color','w','Position',[80 80 720 700]); hold on; axis equal; grid on
xs = -A*cos(n*t).*cos(t);  ys = -A*cos(n*t).*sin(t);       % rosa simetrica k = 1
plot(xs, ys, '--', 'LineWidth', 1.6, 'Color', col_alt);
plot(xm, ym, '-',  'LineWidth', 2.0, 'Color', col_mod);
plot(Pc(:,1), Pc(:,2), '.', 'Color', col_ref, 'MarkerSize', 5);
xlabel('x (cm)'); ylabel('y (cm)');
title('Por que k \neq 1: rosa simetrica frente al modelo estirado');
legend({'Rosa simetrica (k = 1)', sprintf('Modelo estirado (k = %.4f)',k), ...
        'Referencia fisica'}, 'Location','southoutside', ...
        'Orientation','horizontal'); legend boxoff
sv(f5,'fig5_anisotropia');

%% ------------------------------------------------------------------------
%  FIGURA 7 DEL DOCUMENTO  (fig6_diferencial.png)
%  Analisis diferencial sobre el dominio
%% ------------------------------------------------------------------------
rap = hypot(dx, dy);
d2x = gradient(dx,t);  d2y = gradient(dy,t);
kap = abs(dx.*d2y - dy.*d2x) ./ rap.^3;

f6 = figure('Color','w','Position',[80 80 860 620]);
subplot(2,1,1); hold on; grid on
plot(t*180/pi, rap, 'LineWidth', 1.8, 'Color', col_mod);
for tq = t_org; xline(tq*180/pi, ':', 'Color', [.4 .4 .4]); end
xlabel('t (grados)'); ylabel('|r''(t)|  (cm/rad)');
title('Rapidez de recorrido');
xlim([t0 t1]*180/pi);

subplot(2,1,2); hold on; grid on
plot(t*180/pi, kap, 'LineWidth', 1.8, 'Color', col_ref);
for tq = t_org; xline(tq*180/pi, ':', 'Color', [.4 .4 .4]); end
xlabel('t (grados)'); ylabel('\kappa(t)  (1/cm)');
title(sprintf('Curvatura  ·  radio minimo = %.2f cm', 1/max(kap)));
xlim([t0 t1]*180/pi);
sv(f6,'fig6_diferencial');

%% ------------------------------------------------------------------------
%  FIGURA 8 DEL DOCUMENTO  (fig7_dos_referencias.png)
%  El modelo frente a las dos referencias independientes
%% ------------------------------------------------------------------------
if hay_img
    f7 = figure('Color','w','Position',[80 80 760 740]); hold on; axis equal; grid on
    plot(Pc(:,1), Pc(:,2), '.', 'Color', col_ref, 'MarkerSize', 7);
    plot(Pi(:,1), Pi(:,2), '.', 'Color', col_alt, 'MarkerSize', 6);
    plot(xm, ym, 'LineWidth', 2, 'Color', col_mod);
    plot(0, 0, 'k+', 'MarkerSize', 13, 'LineWidth', 1.4);
    xlabel('x (cm)'); ylabel('y (cm)');
    title('El modelo frente a dos referencias independientes');
    legend({sprintf('Trazo fisico, 600 pts   (max %.2f %%)', 100*max(d)/Rmax), ...
            sprintf('Imagen del enunciado, %d pts   (max %.2f %%)', size(Pi,1), 100*max(di)/Rmax), ...
            sprintf('Modelo   (A = %.2f cm, k = %.4f)', A, k), ...
            'Origen'}, 'Location','southoutside'); legend boxoff
    sv(f7,'fig7_dos_referencias');
end

%% ------------------------------------------------------------------------
%  FIGURA 9 DEL DOCUMENTO  (fig8_valor_k.png)
%  Que valor de k reproduce las referencias
%
%  A se mantiene fija en las cuatro curvas. Como la punta del petalo menor
%  vale exactamente A para cualquier k, las cuatro quedan ancladas en esa
%  punta y lo unico que las diferencia es cuanto se alargan los otros dos
%  petalos: es una comparacion de forma, no de tamano.
%% ------------------------------------------------------------------------
if hay_img
    k_test = [k, 1.3652, 1.0982, 1.0000];
    et     = {sprintf('k = %.4f  (modelo declarado)', k), ...
              'k = 1.3652  (ajuste a los pixeles del PDF)', ...
              'k = 1.0982  (ajuste al dataset sin corregir)', ...
              'k = 1.0000  (rosa simetrica pura)'};
    est    = {'-','--',':','-.'};
    colk   = [col_mod; col_ref; 0.10 0.45 0.75; col_alt];

    f8 = figure('Color','w','Position',[80 80 780 780]); hold on; axis equal; grid on
    plot(Pc(:,1), Pc(:,2), '.', 'Color',[0.70 0.70 0.70], 'MarkerSize', 6);
    plot(Pi(:,1), Pi(:,2), '.', 'Color',[0.70 0.70 0.70], 'MarkerSize', 6, ...
         'HandleVisibility','off');
    leyenda = {'Referencias medidas (las dos)'};
    for j = 1:numel(k_test)
        xk = -A * cos(n*t) .* cos(t);
        yk = -A * k_test(j) * cos(n*t) .* sin(t);
        Rk = max(hypot(xk, yk));
        ek = 0;                      % error maximo contra las DOS referencias
        for i = 1:size(Pi,1)
            ek = max(ek, min(hypot(xk - Pi(i,1), yk - Pi(i,2))));
        end
        for i = 1:size(Pc,1)
            ek = max(ek, min(hypot(xk - Pc(i,1), yk - Pc(i,2))));
        end
        plot(xk, yk, est{j}, 'Color', colk(j,:), 'LineWidth', 1.7);
        leyenda{end+1} = sprintf('%s   -   error max %.1f %%', et{j}, 100*ek/Rk); %#ok<AGROW>
    end
    xlabel('x (cm)'); ylabel('y (cm)');
    title('Que valor de k reproduce la referencia');
    legend(leyenda, 'Location','southoutside'); legend boxoff
    sv(f8,'fig8_valor_k');
end

fprintf('Figuras guardadas en ./%s\n', outdir);
fprintf('Rapidez: min %.2f, max %.2f cm/rad  ·  radio de curvatura minimo %.3f cm\n', ...
        min(rap), max(rap), 1/max(kap));

%% ========================================================================
function guardar(f, ruta)
% exportgraphics existe desde R2020a; si no, se usa print
    try
        exportgraphics(f, ruta, 'Resolution', 300);
    catch
        print(f, ruta, '-dpng', '-r300');
    end
end
