function C = mathbot_mallas(carpeta)
%MATHBOT_MALLAS  Carga los cuerpos del robot (meshes/*.stl + meshes/cuerpos.json).
%   C = mathbot_mallas()            carpeta 'meshes' junto a este archivo
%   C = mathbot_mallas(carpeta)
%   C(i).nombre, .padre, .junta ('J1','JZ','J2','J3','JP' o ''), .tipo, .origen (mm),
%   .V (vertices en mm, marco de la junta), .F (caras), .rgb
%   Las mallas las escribe fuente/exportar_modelo.py a partir de las STL del repositorio.
if nargin < 1
    carpeta = fullfile(fileparts(mfilename('fullpath')), 'meshes');
end
info = jsondecode(fileread(fullfile(carpeta, 'cuerpos.json')));
nombres = fieldnames(info);
C = struct('nombre', {}, 'padre', {}, 'junta', {}, 'tipo', {}, 'origen', {}, 'V', {}, 'F', {}, 'rgb', {});
for i = 1:numel(nombres)
    d = info.(nombres{i});
    [V, F] = leerStl(fullfile(carpeta, [nombres{i} '.stl']));
    C(i).nombre = nombres{i};
    C(i).padre  = d.padre;
    C(i).junta  = d.junta;
    C(i).tipo   = d.tipo;
    C(i).origen = d.origen_mm(:)';
    C(i).V      = V * 1000;                      % m -> mm
    C(i).F      = F;
    C(i).rgb    = d.rgb(:)';
end
end

function [V, F] = leerStl(archivo)
% lector de STL binario (sin toolboxes); une los vertices repetidos
fid = fopen(archivo, 'r');
if fid < 0, error('MATHBOT:stl', 'No puedo abrir %s', archivo); end
limpiar = onCleanup(@() fclose(fid));
fread(fid, 80, 'uint8');
n = fread(fid, 1, 'uint32');
datos = fread(fid, [12, n], '12*float32=>double', 2);   % normal (3) + 3 vertices (9); salta 2 bytes
Vt = reshape(datos(4:12, :), 3, 3 * n)';
[V, ~, ic] = unique(Vt, 'rows');
F = reshape(ic, 3, n)';
end
