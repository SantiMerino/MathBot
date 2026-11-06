function f = mathbot_figura(varargin)
%MATHBOT_FIGURA  figure(...) con tema claro (MATLAB Online y R2025a+ abren las figuras en tema oscuro).
f = figure(varargin{:});
try
    theme(f, 'light');
catch
end
end
