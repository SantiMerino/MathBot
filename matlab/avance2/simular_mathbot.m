%% SIMULAR_MATHBOT
% Paso 4. Prototipo virtual 3D: anima el MathBot (SCARA de PLA negro con el cabezal de disco v3)
% ejecutando la mision de trayectoria_mathbot y graba el video (mathbot_simulacion.mp4).
%
% Las mallas son las piezas reales del repositorio (STL del SCARA de HowToMechatronics y CAD del
% cabezal), colocadas como en el panel de operario. Cada cuerpo cuelga de su junta con hgtransform:
%   base -> J1 (columna) -> JZ (plataforma + brazo 1) -> J2 (brazo 2) -> J3 (cabezal) -> JP (plumon)
% La tinta se deja donde la punta del plumon toca la hoja; la rosa deseada se ve en rojo debajo.
%
% Guarda tambien tres capturas para el informe: mathbot_captura_1_inicio.png, _2_trazo.png, _3_final.png
% Para solo mirar sin grabar: en mathbot_parametros pon P.video.grabar = false.
% No requiere toolboxes.

P = mathbot_parametros();
if exist('referencia_mathbot.mat', 'file') ~= 2, trayectoria_mathbot; end
load('referencia_mathbot.mat', 'REF');
C = mathbot_mallas();

%% 1. Escena
fig = mathbot_figura('Name', 'MATHBOT - prototipo virtual', 'Color', 'w', 'Units', 'pixels', ...
             'Position', [40 40 P.video.ancho P.video.alto], 'Resize', 'off', 'MenuBar', 'none', 'ToolBar', 'none');
ax = axes('Parent', fig, 'Units', 'normalized', 'Position', [0 0 1 1]);
hold(ax, 'on');  axis(ax, 'equal');  axis(ax, 'off');
set(ax, 'Clipping', 'off', 'Projection', 'perspective');

% mesa y hoja carta (216 x 279 mm) centrada en la rosa
patch(ax, 'XData', [-320 470 470 -320], 'YData', [-380 -380 380 380], 'ZData', -0.6 * [1 1 1 1], ...
      'FaceColor', [0.86 0.85 0.82], 'EdgeColor', 'none', 'FaceLighting', 'none');
hx = 279/2;  hy = 216/2;
patch(ax, 'XData', P.centro(1) + [-hx hx hx -hx], 'YData', P.centro(2) + [-hy -hy hy hy], 'ZData', -0.1 * [1 1 1 1], ...
      'FaceColor', [1 1 1], 'EdgeColor', [0.75 0.75 0.75], 'FaceLighting', 'none');
plot3(ax, REF.rosa(:, 1), REF.rosa(:, 2), 0.05 * ones(size(REF.rosa, 1), 1), '-', 'Color', [0.9 0.25 0.25], 'LineWidth', 1);
tinta = plot3(ax, nan, nan, nan, '-', 'Color', P.color_tinta, 'LineWidth', 2.4);
mIni = plot3(ax, REF.waypoints(1, 1), REF.waypoints(1, 2), 0.3, 'o', 'MarkerSize', 9, ...
             'MarkerFaceColor', [0.1 0.7 0.3], 'MarkerEdgeColor', 'k', 'Visible', 'off');
mFin = plot3(ax, REF.waypoints(end, 1), REF.waypoints(end, 2), 0.3, 's', 'MarkerSize', 8, ...
             'MarkerFaceColor', [0.9 0.3 0.3], 'MarkerEdgeColor', 'k', 'Visible', 'off');
mPunta = plot3(ax, nan, nan, nan, 'o', 'MarkerSize', 5, 'MarkerFaceColor', [1 0.2 0.2], 'MarkerEdgeColor', 'none');

% cuerpos del robot, cada uno en su hgtransform (anidados como el arbol de juntas)
H = gobjects(numel(C), 1);
for i = 1:numel(C)
    if isempty(C(i).padre)
        padre = ax;
    else
        padre = H(strcmp({C(1:i-1).nombre}, C(i).padre));
    end
    H(i) = hgtransform('Parent', padre, 'Matrix', makehgtform('translate', C(i).origen));
    patch('Parent', H(i), 'Faces', C(i).F, 'Vertices', C(i).V, 'FaceColor', C(i).rgb, 'EdgeColor', 'none', ...
          'FaceLighting', 'flat', 'AmbientStrength', 0.45, 'DiffuseStrength', 0.75, ...
          'SpecularStrength', 0.35, 'SpecularExponent', 12, 'BackFaceLighting', 'lit');
end
movil = find(~strcmp({C.tipo}, 'fixed') & ~strcmp({C.tipo}, 'raiz'));

light(ax, 'Position', [-300 -700 900], 'Style', 'infinite', 'Color', [1 1 1]);
light(ax, 'Position', [700 500 400], 'Style', 'infinite', 'Color', [0.55 0.55 0.6]);
light(ax, 'Position', [-600 400 200], 'Style', 'infinite', 'Color', [0.35 0.35 0.4]);

% camara
objetivo = [95 -10 120];  dist = 1180;  el = 25;  az0 = -58;  camva(ax, 30);
camtarget(ax, objetivo);  camup(ax, [0 0 1]);
ponerCamara = @(az) campos(ax, objetivo + dist * [cosd(el)*cosd(az), cosd(el)*sind(az), sind(el)]);
ponerCamara(az0);
xlim(ax, [-330 480]);  ylim(ax, [-390 390]);  zlim(ax, [-1 430]);

% textos
txtT = text(ax, 0.05, 0.93, 'MATHBOT  |  prototipo virtual: SCARA + cabezal de disco (plumon, electroiman, sensor)', ...
            'Units', 'normalized', 'FontSize', 15, 'FontWeight', 'bold', 'Color', [0.1 0.1 0.12]);
txtF = text(ax, 0.05, 0.885, '', 'Units', 'normalized', 'FontSize', 13, 'Color', [0.15 0.15 0.18]);
txtQ = text(ax, 0.05, 0.85, '', 'Units', 'normalized', 'FontSize', 12, 'FontName', 'Consolas', 'Color', [0.25 0.25 0.28]);
txtE = text(ax, 0.05, 0.815, '', 'Units', 'normalized', 'FontSize', 12, 'FontName', 'Consolas', 'Color', [0.25 0.25 0.28]);
text(ax, 0.05, 0.05, sprintf(['Rosa: x = -A cos(3t) cos(t),  y = -A k cos(3t) sin(t),  A = %.1f mm, k = %.4f  |  ' ...
     'roja = deseada, azul = tinta ejecutada  |  L1 = %d mm, L2 = %d mm, plumon a %d mm de J3'], P.A, P.k, P.L1, P.L2, P.R), ...
     'Units', 'normalized', 'FontSize', 10.5, 'Color', [0.3 0.3 0.33]);

%% 2. Cuadros
fps = P.video.fps;
tv = (0:P.video.acelerar/fps:REF.t(end))';
Q   = interp1(REF.t, REF.q, tv);
LEV = interp1(REF.t, REF.lev, tv);
FAS = interp1(REF.t, REF.fase, tv, 'previous');
conTinta = REF.fase == 7 & REF.punta(:, 3) < 0.5;
D = REF.rosa;  nD = size(D, 1);

vw = [];
if P.video.grabar
    [~, base] = fileparts(P.video.archivo);
    try
        vw = VideoWriter(P.video.archivo, 'MPEG-4');
        vw.Quality = 95;
    catch
        vw = VideoWriter([base '.avi'], 'Motion JPEG AVI');
        fprintf('Este MATLAB no escribe MP4: se graba %s.avi\n', base);
    end
    vw.FrameRate = fps;
    open(vw);
end
capturas = [0.02, (REF.t_ini_trazo + 0.62 * (REF.t_fin_trazo - REF.t_ini_trazo)) / REF.t(end), 0.995];
nombresCap = {'mathbot_captura_1_inicio.png', 'mathbot_captura_2_trazo.png', 'mathbot_captura_3_final.png'};
kCap = round(capturas * (numel(tv) - 1)) + 1;
eMaxVisto = 0;
tamano = [];
fprintf('Animando %d cuadros (%.1f s de mision, %.1fx)...\n', numel(tv), REF.t(end), P.video.acelerar);

for k = 1:numel(tv)
    q = Q(k, :);  lev = LEV(k);
    for i = movil
        switch C(i).junta
            case 'J1', M = makehgtform('zrotate', q(1) * pi/180);
            case 'JZ', M = makehgtform('translate', [0 0 q(4)]);
            case 'J2', M = makehgtform('zrotate', q(2) * pi/180);
            case 'J3', M = makehgtform('zrotate', q(3) * pi/180);
            case 'JP', M = makehgtform('translate', [0 0 lev]);
            otherwise, M = eye(4);
        end
        H(i).Matrix = makehgtform('translate', C(i).origen) * M;
    end
    p = mathbot_fk(q, lev, P);
    set(mPunta, 'XData', p(1), 'YData', p(2), 'ZData', p(3));
    j = find(REF.t <= tv(k), 1, 'last');
    sel = find(conTinta(1:j));
    if ~isempty(sel)
        set(tinta, 'XData', REF.punta(sel, 1), 'YData', REF.punta(sel, 2), 'ZData', 0.25 * ones(numel(sel), 1));
    end
    fase = FAS(k);
    if tv(k) >= REF.t_ini_trazo, mIni.Visible = 'on'; end
    if tv(k) >= REF.t_fin_trazo, mFin.Visible = 'on'; end
    txtF.String = sprintf('t = %5.1f s   |   fase %d/10: %s', tv(k), fase, REF.nombres{fase});
    txtQ.String = sprintf('theta1 = %7.2f deg   theta2 = %7.2f deg   phi (J3) = %7.2f deg   z = %6.1f mm   plumon %s', ...
                          q(1), q(2), q(3), q(4), ternario(lev < 1, 'ABAJO', 'arriba'));
    if fase == 7
        % distancia a la curva deseada: vertice mas cercano y los dos segmentos que lo tocan
        [~, i0] = min(hypot(D(:, 1) - p(1), D(:, 2) - p(2)));
        e = inf;
        for i1 = [max(1, i0-1), i0]
            a = D(i1, :);  ab = D(min(nD, i1+1), :) - a;
            u = min(max(dot(p(1:2) - a, ab) / max(dot(ab, ab), eps), 0), 1);
            e = min(e, norm(p(1:2) - (a + u * ab)));
        end
        eMaxVisto = max(eMaxVisto, e);
        txtE.String = sprintf('punta (%7.2f, %7.2f) mm   error a la curva deseada = %.3f mm   (max %.3f mm)', p(1), p(2), e, eMaxVisto);
    else
        txtE.String = sprintf('punta (%7.2f, %7.2f, %6.2f) mm', p(1), p(2), p(3));
    end
    if P.video.orbita ~= 0
        ponerCamara(az0 + P.video.orbita * (k - 1) / max(1, numel(tv) - 1));
    end
    drawnow;
    if ~isempty(vw) || any(k == kCap)
        fr = getframe(fig);
        if isempty(tamano), tamano = 2 * floor([size(fr.cdata, 1), size(fr.cdata, 2)] / 2); end
        img = fr.cdata(1:min(end, tamano(1)), 1:min(end, tamano(2)), :);
        if size(img, 1) < tamano(1) || size(img, 2) < tamano(2)
            img(tamano(1), tamano(2), 3) = 0;
        end
        if ~isempty(vw), writeVideo(vw, img); end
        c = find(k == kCap, 1);
        if ~isempty(c), imwrite(img, nombresCap{c}); end
    end
    if mod(k, round(numel(tv) / 10)) == 0
        fprintf('  %3.0f %%\n', 100 * k / numel(tv));
    end
end
if ~isempty(vw)
    close(vw);
    fprintf('Video guardado: %s\n', fullfile(pwd, vw.Filename));
end
fprintf('Capturas: %s\n', strjoin(nombresCap, ', '));

%% ---------- funciones locales ----------
function r = ternario(c, a, b)
if c, r = a; else, r = b; end
end
