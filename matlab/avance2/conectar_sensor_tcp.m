%% CONECTAR_SENSOR_TCP  (Simscape Multibody, opcional; adaptado del ejemplo MATHBOT_sim)
% Ejecutar despues de marcar X, Y y Z (Translation, cartesianas) en el bloque Sensor_TCP.
% Conecta las salidas x, y, z del sensor a TCP_x, TCP_y, TCP_z y guarda el modelo.
P = mathbot_parametros();
mdl = '';
cands = {P.modelo, 'mathbot_negro'};
for i = 1:numel(cands)
    if bdIsLoaded(cands{i}) || exist(cands{i}, 'file') == 4
        mdl = cands{i};  break;
    end
end
if isempty(mdl), error('MATHBOT:modelo', 'No encuentro el modelo %s.', P.modelo); end
load_system(mdl);
s = find_system(mdl, 'LookUnderMasks', 'all', 'FollowLinks', 'on', 'Name', 'Sensor_TCP');
if numel(s) ~= 1, error('MATHBOT:sensor', 'No encuentro el bloque Sensor_TCP (ejecuta configurar_modelo_mathbot).'); end
sen = s{1};
padre = get_param(sen, 'Parent');
ph = get_param(sen, 'PortHandles');
% salidas = puertos derechos sin conectar (el puerto F ya esta conectado a JP)
libre = false(1, numel(ph.RConn));
for k = 1:numel(ph.RConn)
    libre(k) = get_param(ph.RConn(k), 'Line') == -1;
end
salidas = ph.RConn(libre);
if numel(salidas) ~= 3
    error('MATHBOT:sensor', ['Sensor_TCP tiene %d salidas libres; deben ser 3 (x, y, z). ' ...
          'Marca solo Translation X, Y, Z y desmarca lo demas.'], numel(salidas));
end
ejes = 'xyz';
for c = 1:3
    phC = get_param([padre '/TCP_' ejes(c)], 'PortHandles');
    lin = get_param(phC.LConn(1), 'Line');
    if lin ~= -1, delete_line(lin); end
    add_line(padre, salidas(c), phC.LConn(1), 'autorouting', 'on');
end
save_system(mdl);
fprintf('[OK] Sensor_TCP x, y, z -> TCP_x, TCP_y, TCP_z. Revisa en el diagrama que cada linea salga de la etiqueta correcta.\n');
