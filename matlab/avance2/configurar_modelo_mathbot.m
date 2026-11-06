%% CONFIGURAR_MODELO_MATHBOT  (Simscape Multibody, opcional)
% Adaptado del ejemplo MATHBOT_sim al MathBot negro con el cabezal de disco (junta JP del plumon).
% Ejecutar DESPUES de importar el URDF:
%     smimport('mathbot_negro.urdf', 'ModelName', 'mathbot_sim')
% y de haber ejecutado trayectoria_mathbot.
%
% Sobre el modelo importado hace:
%   a) J1, JZ, J2, J3, JP: Motion = Provided by Input; Torque/Force = Automatically Computed
%   b) por cada junta: From Workspace (ref_J*) -> Simulink-PS Converter (rad o m,
%      filtro de 2o orden) -> puerto q de la junta
%   c) Transform Sensor 'Sensor_TCP' (B = marco base en J1, F = marco del plumon = su PUNTA = TCP)
%      con las salidas X, Y, Z activadas, y la cadena PS-Simulink (mm) -> Mux -> To Workspace 'tcp_sim'
%      (llama a conectar_sensor_tcp al final). Probado en MATLAB Online R2026b.
%   d) solver ode23t, paso maximo 0.01 s, tiempo final = T_sim; guarda el modelo
% Lo que no pueda hacer lo reporta como [MANUAL] con la instruccion.
% Se puede ejecutar varias veces: borra y vuelve a crear los bloques que agrega.

P = mathbot_parametros();
if exist('referencia_mathbot.mat', 'file') == 2
    load('referencia_mathbot.mat');
else
    trayectoria_mathbot;
end

%% Modelo
mdl = '';
cands = {P.modelo, 'mathbot_negro'};
for i = 1:numel(cands)
    if bdIsLoaded(cands{i}) || exist(cands{i}, 'file') == 4
        mdl = cands{i};  break;
    end
end
if isempty(mdl)
    error('MATHBOT:modelo', ['No encuentro el modelo. Primero ejecuta:\n' ...
          '  smimport(''mathbot_negro.urdf'', ''ModelName'', ''%s'')'], P.modelo);
end
load_system(mdl);  open_system(mdl);
fprintf('\nModelo: %s\n', mdl);
manual = {};

%% a) y b) Juntas y referencias
juntas = {'J1', 'rad'; 'JZ', 'm'; 'J2', 'rad'; 'J3', 'rad'; 'JP', 'm'};
nJ = size(juntas, 1);                 % la ultima (JP) lleva el TCP: su marco F es la punta del plumon
blkJ = cell(nJ, 1);
puertoB = zeros(1, nJ);  puertoF = zeros(1, nJ);
for i = 1:nJ
    nombre = juntas{i, 1};
    blk = buscarBloqueMathbot(mdl, nombre);
    if isempty(blk)
        manual{end+1} = sprintf('No encontre la junta %s: pegame la lista de bloques que se imprimio arriba.', nombre); %#ok<SAGROW>
        continue;
    end
    blkJ{i} = blk;
    padre = get_param(blk, 'Parent');
    borrarBloqueMathbot([padre '/Ref_' nombre]);
    borrarBloqueMathbot([padre '/PS_' nombre]);

    try
        set_param(blk, 'MotionActuationMode', 'InputMotion');
        try
            % R2026b: las prismaticas tambien usan TorqueActuationMode (enum NoTorque/InputTorque/ComputedTorque)
            set_param(blk, 'TorqueActuationMode', 'ComputedTorque');
        catch
            set_param(blk, 'ForceActuationMode', 'ComputedForce');   % versiones anteriores
        end
        fprintf('[OK] %s: movimiento por entrada, esfuerzo calculado\n', nombre);
    catch ME
        manual{end+1} = sprintf(['Abre %s > Actuation: Motion = Provided by Input; ' ...
            'Torque (o Force) = Automatically Computed.  [%s]'], nombre, ME.message); %#ok<SAGROW>
    end

    pos = get_param(blk, 'Position');
    fw = add_block('simulink/Sources/From Workspace', [padre '/Ref_' nombre], ...
        'Position', [pos(1)-340, pos(2)-90, pos(1)-240, pos(2)-60]);
    set_param(fw, 'VariableName', ['ref_' nombre], 'Interpolate', 'on', ...
        'OutputAfterFinalValue', 'Holding final value');
    ps = add_block('nesl_utility/Simulink-PS Converter', [padre '/PS_' nombre], ...
        'Position', [pos(1)-180, pos(2)-90, pos(1)-145, pos(2)-60]);
    try
        set_param(ps, 'Unit', juntas{i, 2});
    catch ME
        manual{end+1} = sprintf('Abre PS_%s: Input signal unit = %s.  [%s]', nombre, juntas{i, 2}, ME.message); %#ok<SAGROW>
    end
    try
        set_param(ps, 'FilteringAndDerivatives', 'filter', 'SimscapeFilterOrder', '2', ...
            'InputFilterTimeConstant', num2str(P.tau_filtro));
    catch ME
        manual{end+1} = sprintf(['Abre PS_%s > Input Handling: Filtering and derivatives = Filter input, ' ...
            'derivatives calculated; Input filtering order = Second-order filtering; ' ...
            'Input filter time constant = %g s.  [%s]'], nombre, P.tau_filtro, ME.message); %#ok<SAGROW>
    end
    phF = get_param(fw, 'PortHandles');
    phP = get_param(ps, 'PortHandles');
    add_line(padre, phF.Outport(1), phP.Inport(1), 'autorouting', 'on');

    % puerto q de la junta = el puerto izquierdo que quedo sin conectar (B ya esta conectado)
    phJ = get_param(blk, 'PortHandles');
    libre = puertosLibresMathbot(phJ.LConn);
    if ~any(libre) && numel(phJ.LConn) == 2, libre = [false true]; end
    libres = phJ.LConn(libre);
    ocup = phJ.LConn(~libre);
    if ~isempty(ocup), puertoB(i) = ocup(1); end
    ocupR = phJ.RConn(~puertosLibresMathbot(phJ.RConn));
    if ~isempty(ocupR), puertoF(i) = ocupR(1); else, puertoF(i) = phJ.RConn(1); end
    if numel(libres) == 1
        add_line(padre, phP.RConn(1), libres(1), 'autorouting', 'on');
        fprintf('[OK] %s: Ref_%s -> PS_%s (%s) -> q\n', nombre, nombre, nombre, juntas{i, 2});
    else
        manual{end+1} = sprintf('Conecta la salida de PS_%s al puerto q de %s (encontre %d puertos libres).', ...
            nombre, nombre, numel(libres)); %#ok<SAGROW>
    end
end

%% c) Sensor del TCP y salida a workspace
if ~isempty(blkJ{1}) && ~isempty(blkJ{nJ}) && strcmp(get_param(blkJ{1}, 'Parent'), get_param(blkJ{nJ}, 'Parent'))
    padre = get_param(blkJ{1}, 'Parent');
    nombresTCP = {'Sensor_TCP', 'TCP_x', 'TCP_y', 'TCP_z', 'Mux_TCP', 'TCP_a_workspace'};
    for i = 1:numel(nombresTCP), borrarBloqueMathbot([padre '/' nombresTCP{i}]); end
    p3 = get_param(blkJ{nJ}, 'Position');
    x0 = p3(3) + 160;  y0 = p3(4) + 120;
    sen = add_block('sm_lib/Frames and Transforms/Transform Sensor', [padre '/Sensor_TCP'], ...
        'Position', [x0, y0, x0+60, y0+80]);
    phS = get_param(sen, 'PortHandles');
    try
        add_line(padre, phS.LConn(1), puertoB(1), 'autorouting', 'on');   % B: marco base (= mundo)
        add_line(padre, phS.RConn(1), puertoF(nJ), 'autorouting', 'on');  % F: marco del plumon = punta (TCP)
        fprintf('[OK] Sensor_TCP: B -> puerto B de J1 (base), F -> puerto F de JP (punta del plumon)\n');
    catch ME
        manual{end+1} = sprintf(['Conecta Sensor_TCP: B a la linea del puerto B de J1, ' ...
            'F a la linea del puerto F de JP.  [%s]'], ME.message); %#ok<SAGROW>
    end
    ejes = 'xyz';
    hC = zeros(1, 3);
    for c = 1:3
        hC(c) = add_block('nesl_utility/PS-Simulink Converter', [padre '/TCP_' ejes(c)], ...
            'Position', [x0+200, y0+(c-1)*45, x0+235, y0+(c-1)*45+25]);
        try
            set_param(hC(c), 'Unit', 'mm');
        catch ME
            manual{end+1} = sprintf('Abre TCP_%s: Output signal unit = mm.  [%s]', ejes(c), ME.message); %#ok<SAGROW>
        end
    end
    mux = add_block('simulink/Signal Routing/Mux', [padre '/Mux_TCP'], 'Inputs', '3', ...
        'Position', [x0+300, y0, x0+305, y0+115]);
    tw  = add_block('simulink/Sinks/To Workspace', [padre '/TCP_a_workspace'], ...
        'Position', [x0+360, y0+40, x0+460, y0+70]);
    set_param(tw, 'VariableName', 'tcp_sim', 'SaveFormat', 'Timeseries');
    phM = get_param(mux, 'PortHandles');
    for c = 1:3
        phC = get_param(hC(c), 'PortHandles');
        add_line(padre, phC.Outport(1), phM.Inport(c), 'autorouting', 'on');
    end
    phT = get_param(tw, 'PortHandles');
    add_line(padre, phM.Outport(1), phT.Inport(1), 'autorouting', 'on');
    fprintf('[OK] TCP_x, TCP_y, TCP_z (mm) -> Mux_TCP -> To Workspace (tcp_sim)\n');
    try
        set_param(sen, 'SenseX', 'on', 'SenseY', 'on', 'SenseZ', 'on');   % Translation X, Y, Z (cartesianas)
        sensorListo = true;
        fprintf('[OK] Sensor_TCP: salidas de traslacion X, Y, Z activadas\n');
    catch ME
        sensorListo = false;
        manual{end+1} = sprintf(['Abre Sensor_TCP y en Translation marca X, Y y Z (cartesianas). Acepta y ' ...
            'luego ejecuta: conectar_sensor_tcp  [%s]'], ME.message); %#ok<SAGROW>
    end
else
    manual{end+1} = ['No pude ubicar J1 y JP en el mismo subsistema: agrega un Transform Sensor ' ...
        'con B en el marco base y F en el marco del plumon (puerto F de JP).']; %#ok<SAGROW>
end

%% d) Solver, tiempo y guardado
set_param(mdl, 'StopTime', num2str(T_sim), 'Solver', 'ode23t', 'MaxStep', '0.01', ...
    'ReturnWorkspaceOutputs', 'on');
save_system(mdl);
fprintf('[OK] Solver ode23t, MaxStep 0.01 s, StopTime %.2f s. Modelo guardado: %s\n', T_sim, which(mdl));
if exist('sensorListo', 'var') && sensorListo
    conectar_sensor_tcp;                      % une x, y, z del sensor con TCP_x, TCP_y, TCP_z y guarda
end

fprintf('\nPENDIENTE (%d):\n', numel(manual));
for i = 1:numel(manual), fprintf('  [MANUAL] %s\n', manual{i}); end
fprintf('\n');

%% ---------- funciones locales ----------
function blk = buscarBloqueMathbot(mdl, nombre)
c = find_system(mdl, 'LookUnderMasks', 'all', 'FollowLinks', 'on', 'Name', nombre);
if isempty(c)
    c = find_system(mdl, 'LookUnderMasks', 'all', 'FollowLinks', 'on', 'RegExp', 'on', ...
        'Name', ['^' nombre '([^0-9A-Za-z]|$)']);
end
if numel(c) == 1
    blk = c{1};
    return;
end
blk = '';
fprintf('[MANUAL] No encontre un bloque unico llamado %s (%d candidatos). Bloques del modelo:\n', nombre, numel(c));
todos = find_system(mdl, 'SearchDepth', 2, 'Type', 'Block');
for k = 1:min(numel(todos), 60)
    fprintf('    %s\n', todos{k});
end
end

function libre = puertosLibresMathbot(h)
% true para cada puerto sin linea conectada
libre = false(1, numel(h));
for k = 1:numel(h)
    try
        libre(k) = get_param(h(k), 'Line') == -1;
    catch
        libre(k) = false;
    end
end
end

function borrarBloqueMathbot(ruta)
if getSimulinkBlockHandle(ruta) > 0
    lh = get_param(ruta, 'LineHandles');
    f = fieldnames(lh);
    for k = 1:numel(f)
        h = lh.(f{k});
        h = h(h > 0);
        for m = 1:numel(h)
            try, delete_line(h(m)); catch, end
        end
    end
    delete_block(ruta);
end
end
