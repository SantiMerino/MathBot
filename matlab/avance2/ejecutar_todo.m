%% EJECUTAR_TODO  MathBot, Segundo avance: corre toda la simulacion en orden.
% Abrir MATLAB con la carpeta actual = matlab/avance2 y ejecutar:  ejecutar_todo
%   0) verificar_entorno      archivos y toolboxes
%   1) trayectoria_mathbot    mision HOME -> rosa -> HOME (como el firmware) -> referencia_mathbot.mat
%   2) optimizar_mathbot      mejora: ubicacion de la rosa (jacobiano, antes vs despues)
%   3) validar_mathbot        deseada vs ejecutada, error y precision -> validacion_mathbot.png
%   4) simular_mathbot        prototipo virtual 3D y video -> mathbot_simulacion.mp4 + capturas
% No requiere toolboxes. Tarda unos minutos (el video es lo mas lento).
clc;  close all;
verificar_entorno;
trayectoria_mathbot;
optimizar_mathbot;
validar_mathbot;
simular_mathbot;
