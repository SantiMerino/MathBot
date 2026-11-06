function [J, sMax, sMin] = mathbot_jacobiano(th1, th2, P)
%MATHBOT_JACOBIANO  Jacobiano de la punta del plumon (J3 fijo, eslabon equivalente Le = L2 + R).
%   [J, sMax, sMin] = mathbot_jacobiano(th1, th2, P)
%   th1, th2 en grados (vectores N x 1).
%   J    : 2 x 2 x N, en mm/rad:  [dx; dy] = J * [dtheta1; dtheta2]
%   sMax : N x 1 valor singular mayor -> peor caso: |dp| <= sMax * |dtheta|
%   sMin : N x 1 valor singular menor; condicion kappa = sMax ./ sMin
Le = P.L2 + P.R;
t1  = th1(:) * pi/180;
t12 = (th1(:) + th2(:)) * pi/180;
n = numel(t1);
J = zeros(2, 2, n);
J(1, 1, :) = -P.L1 * sin(t1) - Le * sin(t12);
J(1, 2, :) = -Le * sin(t12);
J(2, 1, :) =  P.L1 * cos(t1) + Le * cos(t12);
J(2, 2, :) =  Le * cos(t12);
% valores singulares de una 2x2 en forma cerrada
a = squeeze(J(1, 1, :));  b = squeeze(J(1, 2, :));
c = squeeze(J(2, 1, :));  d = squeeze(J(2, 2, :));
S1 = a.^2 + b.^2 + c.^2 + d.^2;
S2 = sqrt((a.^2 + b.^2 - c.^2 - d.^2).^2 + 4 * (a.*c + b.*d).^2);
sMax = sqrt((S1 + S2) / 2);
sMin = sqrt(max((S1 - S2) / 2, 0));
end
