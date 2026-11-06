function P = mathbot_parametros()
%MATHBOT_PARAMETROS  Todos los datos de la simulacion del MathBot (SCARA negro + cabezal de disco v3).
%   P = mathbot_parametros() devuelve una estructura.
%   UNIDADES: mm, grados y segundos (los scripts pasan a m y rad solo para Simscape).
%
%   Las secciones A y B copian el firmware (firmware/mathbot_mega/mathbot_mega.ino v3.0) y el CAD:
%   si cambian alla, cambian aqui. Las secciones C y D se pueden editar.

%% A. Geometria del robot (STL "updated" de HowToMechatronics + cabezal de disco v3)
P.L1      = 228;            % mm  eje J1 -> eje J2 (medido en Arm 1.STL)
P.L2      = 144;            % mm  eje J2 -> eje J3 (medido en Arm 2.STL; el codigo de HTM usa 136.5)
P.R       = 55;             % mm  radio de las tres herramientas del disco (eje de J3 -> herramienta)
P.herr    = {'plumon', 'electroiman', 'sensor'};
P.PHI     = [0 120 240];    % deg posicion de cada herramienta en el disco
P.BAJO    = [50 40 40];     % mm  cuanto sobresale cada herramienta bajo la placa del disco
P.DISCO   = 20;             % mm  separador de brida (14) + placa trebol (6)
P.CAIDA   = 80.5;           % mm  base de la plataforma Z -> brida del cabezal
P.LEVANTE = 18;             % mm  carrera del servo SG90 que sube el plumon
P.LIM_J   = 150;            % deg limite de J1 y J2 (finales de carrera / cables)
P.ZMAX    = 203;            % mm  tope de la plataforma Z (varillas de 250 mm)
P.ZMIN    = 140.5;          % mm  minimo con el cabezal puesto

% Transmisiones: NEMA 17, 200 pasos/rev, 1/4 de micropaso
P.PASOS   = [44.4444 35.5556 10 100];   % pasos por grado (J1, J2, J3) y por mm (Z)
P.VMAX    = [3000 3000 1500 3500];      % pasos/s
P.ACEL    = [2000 2000 1500 3000];      % pasos/s^2

% Obstaculos sobre la mesa (marco de J1): base del robot y caja del Arduino [x0 x1 y0 y1]
P.BASE    = [-150 65 -70 70];
P.CAJA    = [-235 -150 -60 60];

%% B. Trayectoria: rosa de tres petalos del Avance 1 (ajustada con la retroalimentacion)
% x(t) = -A cos(3t) cos(t),  y(t) = -A k cos(3t) sin(t)
P.A       = 102.9;          % mm   longitud de los petalos
P.k       = 1.3552;         % -    estiramiento en y (escala anisotropa del PDF de referencia)
P.t0      = 5*pi/6;         % rad  arranca en el centro de la rosa (r = 0)
P.t1      = 11*pi/6;        % rad  un periodo completo (pi): los tres petalos una sola vez

%% C. Ubicacion de la rosa y mision (como CFG_FABRICA del firmware)
P.centro  = [185 0];        % mm   centro de la rosa en el marco del robot (resultado de optimizar_mathbot)
P.giro    = 180;            % deg  giro de la rosa respecto al eje x del robot
P.codo    = -1;             % -1: theta2 negativo (codo a la derecha, como el firmware)
P.zmesa   = 0;              % mm   altura del papel sobre la mesa
P.home    = [-89 -152.4 -120 203];   % [J1 J2 J3 deg, Z mm] pose de HOME (finales de carrera)
P.v_trazo = 25;             % mm/s velocidad de la punta al trazar
P.seg_mm  = 1;              % mm   largo de cada tramo recto del trazo (SEG_MM del firmware)
P.tip_transito = 60;        % mm   altura de la punta al moverse entre puntos
P.t_servo = 0.35;           % s    tiempo del servo para subir o bajar el plumon
P.t_reposo = 1;             % s    reposo al inicio y al final
P.dt      = 0.01;           % s    muestreo de la referencia

%% D. Animacion, video y validacion
P.video.archivo  = 'mathbot_simulacion.mp4';
P.video.grabar   = true;    % false: solo anima en pantalla
P.video.fps      = 30;
P.video.acelerar = 1;       % 1 = tiempo real; 2 = el video dura la mitad
P.video.ancho    = 1280;
P.video.alto     = 720;
P.video.orbita   = 25;      % deg que gira la camara durante todo el video (0 = camara fija)
P.color_tinta    = [0.05 0.10 0.45];
P.tol_mm         = 0.5;     % mm  tolerancia del error de trayectoria en la validacion
P.modelo         = 'mathbot_sim';   % nombre del modelo de Simscape (opcional, ver LEEME)
P.tau_filtro     = 0.002;   % s   filtro de las entradas de movimiento en Simscape (Simulink-PS Converter)
P.graficar       = true;
end
