%% ========================================================================
%  VARIACIONES DE LA TRAYECTORIA PARAMETRICA  -  PBL MATHBOT - Calculo III
%  ------------------------------------------------------------------------
%  Todas las variantes comparten la MISMA familia funcional (rosa polar de
%  tres petalos compuesta con el estiramiento afin diag(1,k)):
%
%       x(t) = -A * cos( n*(t - phi) ) * cos(t)
%       y(t) = -A * k * cos( n*(t - phi) ) * sin(t)
%
%       n = 3        t en [5*pi/6, 11*pi/6]
%
%  Lo unico que cambia entre variantes es (A, k, phi).
%  A  = escala        k = anisotropia (forma)      phi = fase (rotacion)
%
%  Descriptores analiticos (utiles para comparar):
%       razon punta mayor/menor:  rho = sqrt(1 + 3*k^2) / 2
%       angulo de la punta mayor: tan(psi) = sqrt(3) * k
%  ========================================================================
clear; clc; close all;

n = 3;
t = linspace(5*pi/6, 11*pi/6, 3000);

%% ---- BLOQUE 1 - Definicion de las variantes ----------------------------
%   etiqueta                                      A_propia    k        phi[deg]
V = {
    'V1 - Avance 1 (regla + 600 pts del trazo)',    10.29,   1.3552,   0
    'V2 - Solo escala sobre dataset wpd',           11.826,  1.3552,   0
    'V3 - Ajuste completo sobre dataset wpd',       12.686,  1.0982,  -0.18
    'V4 - Ajuste a los pixeles del PDF',          1611.13,   1.3652,  -0.013
    'V5 - k despejado de la razon de puntas',       10.29,   1.3622,   0
    'V6 - Rosa simetrica pura (k = 1)',             10.29,   1.0000,   0
};

%% ---- BLOQUE 2 - Modo de comparacion ------------------------------------
%  'forma'  -> todas con la misma A (10.29 cm): solo se compara la FORMA.
%              Es el modo util, porque A es solo un factor de escala.
%  'propia' -> cada variante con la A con la que fue obtenida.
%              Ojo: V4 esta en pixeles (A = 1611), va a dominar la figura.
MODO = 'forma';
A_COMUN = 10.29;              % cm - escala fisica del Avance 1

%% ---- BLOQUE 3 - Trazado ------------------------------------------------
colores = [0.00 0.00 0.00
           0.85 0.33 0.10
           0.00 0.45 0.74
           0.80 0.00 0.10
           0.47 0.67 0.19
           0.49 0.18 0.56];
estilos = {'-','--',':','--','-.','-.'};

figure('Color','w','Position',[100 100 760 760]); hold on; grid on; box on;
for i = 1:size(V,1)
    A   = V{i,2};
    k   = V{i,3};
    phi = deg2rad(V{i,4});
    if strcmp(MODO,'forma'), A = A_COMUN; end

    c = cos(n*(t - phi));
    x = -A .* c .* cos(t);
    y = -A .* k .* c .* sin(t);

    plot(x, y, estilos{i}, 'Color', colores(i,:), 'LineWidth', 1.7, ...
         'DisplayName', sprintf('%s  -  k = %.4f', V{i,1}, k));
end
yline(0,'k-','LineWidth',0.6,'HandleVisibility','off');
xline(0,'k-','LineWidth',0.6,'HandleVisibility','off');
axis equal;
xlabel('X'); ylabel('Y');
title('Variaciones de la trayectoria parametrica');
legend('Location','southoutside','Interpreter','none');

%% ---- BLOQUE 4 - Tabla de descriptores ----------------------------------
fprintf('\n%-46s %8s %9s %9s\n','variante','k','rho','psi [deg]');
fprintf('%s\n', repmat('-',1,76));
for i = 1:size(V,1)
    k   = V{i,3};
    rho = sqrt(1 + 3*k^2)/2;
    psi = atand(sqrt(3)*k);
    fprintf('%-46s %8.4f %9.4f %9.2f\n', V{i,1}, k, rho, psi);
end
fprintf('%s\n', repmat('-',1,76));
fprintf('%-46s %8s %9.4f %9.2f\n','MEDIDO sobre la imagen del PDF','--',1.2813,67.68);
fprintf(['\nrho = razon punta mayor / punta menor = sqrt(1+3k^2)/2\n' ...
         'psi = angulo de la punta mayor = atand(sqrt(3)*k)\n' ...
         'k despejado de una razon medida:  k = sqrt((4*rho^2 - 1)/3)\n\n']);

%% ---- BLOQUE 5 - Puntos notables de una variante ------------------------
%  Cambiar el indice para inspeccionar otra variante.
idx = 1;
A = V{idx,2}; k = V{idx,3}; phi = deg2rad(V{idx,4});
if strcmp(MODO,'forma'), A = A_COMUN; end

t_ceros  = [5*pi/6, 7*pi/6, 3*pi/2, 11*pi/6];   % pasos por el origen
t_puntas = [pi, 4*pi/3, 5*pi/3];                % punta menor, Q1, Q4

fprintf('Variante inspeccionada: %s\n', V{idx,1});
for tt = t_puntas
    c = cos(n*(tt - phi));
    xp = -A*c*cos(tt);  yp = -A*k*c*sin(tt);
    fprintf('  t = %6.1f deg  ->  (%8.4f, %8.4f)   |r| = %8.4f\n', ...
            rad2deg(tt), xp, yp, hypot(xp,yp));
end
fprintf('  pasos por el origen en t = %s deg\n', mat2str(rad2deg(t_ceros)));
