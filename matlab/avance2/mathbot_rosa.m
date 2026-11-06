function [x, y] = mathbot_rosa(t, P, enRobot)
%MATHBOT_ROSA  Rosa de tres petalos del Avance 1.
%   [x, y] = mathbot_rosa(t, P)          marco del dibujo (mm)
%   [x, y] = mathbot_rosa(t, P, true)    marco del robot: girada P.giro y trasladada a P.centro
%   x(t) = -A cos(3t) cos(t),  y(t) = -A k cos(3t) sin(t)
r = -P.A .* cos(3 .* t);
x = r .* cos(t);
y = P.k .* r .* sin(t);
if nargin > 2 && enRobot
    a = P.giro * pi/180;
    xr = P.centro(1) + cos(a) .* x - sin(a) .* y;
    yr = P.centro(2) + sin(a) .* x + cos(a) .* y;
    x = xr;  y = yr;
end
end
