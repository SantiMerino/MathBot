function [th1, th2, ok] = mathbot_ik(x, y, P, herr)
%MATHBOT_IK  Cinematica inversa de la punta de una herramienta del disco (mm -> grados).
%   [th1, th2, ok] = mathbot_ik(x, y, P)          plumon (herramienta 1)
%   [th1, th2, ok] = mathbot_ik(x, y, P, herr)    herr = 1 plumon, 2 electroiman, 3 sensor
%
%   Como el firmware, J3 gira para dejar la herramienta activa al frente (phi = -PHI(herr)): la
%   herramienta queda alineada con el brazo 2 y el robot se resuelve como un 2R de eslabones
%   L1 y Le = L2 + R. Usa el codo P.codo y, si se sale de +-LIM_J, prueba el codo contrario.
%   ok = false donde el punto no se alcanza.
if nargin < 4, herr = 1; end %#ok<NASGU>
Le = P.L2 + P.R;
c2 = (x.^2 + y.^2 - P.L1^2 - Le^2) ./ (2 * P.L1 * Le);
dentro = abs(c2) <= 1;
c2 = min(max(c2, -1), 1);
th1 = zeros(size(x));  th2 = zeros(size(x));  ok = false(size(x));
for codo = [P.codo, -P.codo]
    t2 = codo .* acos(c2);
    t1 = atan2(y, x) - atan2(Le .* sin(t2), P.L1 + Le .* cos(t2));
    a1 = envolver(t1 * 180/pi);
    a2 = envolver(t2 * 180/pi);
    nuevo = ~ok & dentro & abs(a1) <= P.LIM_J & abs(a2) <= P.LIM_J;
    th1(nuevo) = a1(nuevo);
    th2(nuevo) = a2(nuevo);
    ok = ok | nuevo;
end
end

function a = envolver(a)
a = mod(a + 180, 360) - 180;
end
