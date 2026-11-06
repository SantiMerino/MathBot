%% VERIFICAR_ENTORNO  Comprueba MATLAB y los archivos del MathBot (paso 0).
% La simulacion principal (trayectoria, optimizacion, validacion y video) NO necesita toolboxes.
% Simulink + Simscape + Simscape Multibody solo hacen falta para el modelo opcional de Simscape.
fprintf('\nMATLAB %s\n', version);
archivos = {'mathbot_negro.urdf', 'meshes/cuerpos.json', 'meshes/base_link.stl', 'meshes/columna.stl', ...
            'meshes/carro.stl', 'meshes/brazo2.stl', 'meshes/cabezal.stl', 'meshes/plumon.stl'};
archivosOK = true;
for i = 1:numel(archivos)
    if exist(archivos{i}, 'file') == 2
        fprintf('  [OK]    %s\n', archivos{i});
    else
        fprintf('  [FALTA] %s  (la carpeta actual debe ser matlab/avance2)\n', archivos{i});
        archivosOK = false;
    end
end
v = ver;
nombres = {v.Name};
req = {'Simulink', 'Simscape', 'Simscape Multibody'};
simscapeOK = true;
for i = 1:numel(req)
    j = find(strcmp(nombres, req{i}), 1);
    if isempty(j)
        fprintf('  [no esta] %s (solo para el modelo opcional de Simscape)\n', req{i});  simscapeOK = false;
    else
        fprintf('  [OK]    %s %s\n', v(j).Name, v(j).Version);
    end
end
if simscapeOK
    libs = {'sm_lib', 'nesl_utility'};
    for i = 1:numel(libs)
        try
            load_system(libs{i});
            fprintf('  [OK]    libreria %s carga\n', libs{i});
        catch ME
            fprintf('  [ERROR] libreria %s: %s\n', libs{i}, ME.message);  simscapeOK = false;
        end
    end
end
if archivosOK
    fprintf('Listo para ejecutar_todo.');
    if simscapeOK, fprintf(' Simscape disponible (pasos opcionales del LEEME).'); end
    fprintf('\n\n');
else
    fprintf('Faltan archivos: abre la carpeta matlab/avance2 en MATLAB.\n\n');
end
