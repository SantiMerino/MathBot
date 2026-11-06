function [punta, j2, j3] = mathbot_fk(q, lev, P, herr)
%MATHBOT_FK  Cinematica directa del MathBot.
%   [punta, j2, j3] = mathbot_fk(q, lev, P)        punta del plumon
%   [punta, j2, j3] = mathbot_fk(q, lev, P, herr)  herr = 1 plumon, 2 electroiman, 3 sensor
%   q   : N x 4  [theta1 theta2 phi (grados), z de la plataforma (mm)]
%   lev : N x 1  levante del plumon (mm, 0 = abajo); solo afecta al plumon
%   punta, j2, j3 : N x 3 / N x 2 / N x 2 en mm (marco del robot, z = 0 en la mesa)
if nargin < 4, herr = 1; end
if isscalar(lev), lev = lev * ones(size(q, 1), 1); end
a1  = q(:, 1) * pi/180;
a12 = (q(:, 1) + q(:, 2)) * pi/180;
psi = (q(:, 1) + q(:, 2) + q(:, 3) + P.PHI(herr)) * pi/180;
j2 = [P.L1 * cos(a1), P.L1 * sin(a1)];
j3 = j2 + [P.L2 * cos(a12), P.L2 * sin(a12)];
z  = q(:, 4) - P.CAIDA - P.DISCO - P.BAJO(herr) - P.zmesa;
if herr == 1, z = z + lev(:); end
punta = [j3 + P.R * [cos(psi), sin(psi)], z];
end
