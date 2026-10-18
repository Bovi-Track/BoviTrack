-- RF-UC14-01/03: ejecutar como propietario después de los SQL de compras,
-- inventario y offline. Repetible, transaccional. No aplicar parcialmente.
-- Revisar primero uc14_control_acceso_verificacion.sql contra la BD destino.
-- Se preservan membresías, invitaciones e historial al consolidar los roles.
-- Para alta directa por correo con ambos roles, aplicar después uc14_agregar_miembro_ambos_roles.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

-- Impide que otra sesión cree asociaciones con IDs de roles que se van a consolidar.
LOCK TABLE public.roles, public.usuario_finca, public.invitacion_finca IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE v_nombre text; v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.roles WHERE upper(btrim(nombre)) NOT IN
      ('ADMINISTRADOR','ADMINISTRADOR DE FINCA','PERSONAL_CAMPO','PERSONAL DE CAMPO')) THEN
    RAISE EXCEPTION 'Hay roles desconocidos. Revisarlos antes de consolidar; no se asignarán permisos automáticamente.';
  END IF;
  FOREACH v_nombre IN ARRAY ARRAY['ADMINISTRADOR','PERSONAL_CAMPO'] LOOP
    SELECT id INTO v_id FROM public.roles WHERE nombre=v_nombre;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.roles
        WHERE upper(btrim(nombre)) IN (v_nombre, CASE v_nombre WHEN 'ADMINISTRADOR'
          THEN 'ADMINISTRADOR DE FINCA' ELSE 'PERSONAL DE CAMPO' END) ORDER BY id LIMIT 1;
      IF v_id IS NULL THEN
        INSERT INTO public.roles(nombre) VALUES(v_nombre) RETURNING id INTO v_id;
      ELSE
        UPDATE public.roles SET nombre=v_nombre WHERE id=v_id;
      END IF;
    END IF;
    UPDATE public.usuario_finca SET rol_id=v_id WHERE rol_id IN (
      SELECT id FROM public.roles WHERE id<>v_id AND upper(btrim(nombre)) IN
        (v_nombre, CASE v_nombre WHEN 'ADMINISTRADOR' THEN 'ADMINISTRADOR DE FINCA' ELSE 'PERSONAL DE CAMPO' END));
    UPDATE public.invitacion_finca SET rol_id=v_id WHERE rol_id IN (
      SELECT id FROM public.roles WHERE id<>v_id AND upper(btrim(nombre)) IN
        (v_nombre, CASE v_nombre WHEN 'ADMINISTRADOR' THEN 'ADMINISTRADOR DE FINCA' ELSE 'PERSONAL DE CAMPO' END));
    DELETE FROM public.roles WHERE id<>v_id AND upper(btrim(nombre)) IN
      (v_nombre, CASE v_nombre WHEN 'ADMINISTRADOR' THEN 'ADMINISTRADOR DE FINCA' ELSE 'PERSONAL DE CAMPO' END);
  END LOOP;
END $$;
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_nombres_canonicos;
ALTER TABLE public.roles ADD CONSTRAINT roles_nombres_canonicos CHECK(nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO'));

-- Comprueba el perfil real sin confiar en metadata modificable del JWT.
CREATE OR REPLACE FUNCTION private.cuenta_activa() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.perfil_usuario p WHERE p.id=auth.uid() AND p.activo);
$$;
-- Obtiene el rol de la finca para la cuenta activa. Los roles desconocidos no autorizan.
CREATE OR REPLACE FUNCTION private.rol_finca(p_finca_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.nombre::text FROM public.usuario_finca uf
    JOIN public.perfil_usuario p ON p.id=uf.usuario_id AND p.activo
    JOIN public.roles r ON r.id=uf.rol_id AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO')
    WHERE uf.usuario_id=auth.uid() AND uf.finca_id=p_finca_id;
$$;
-- Exige los permisos compartidos por las RPC y devuelve el responsable autenticado.
CREATE OR REPLACE FUNCTION private.validar_acceso_finca(
  p_finca_id uuid, p_admin boolean DEFAULT false, p_activa boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rol text;
BEGIN
  IF NOT private.cuenta_activa() THEN
    RAISE EXCEPTION 'CUENTA_INACTIVA: La cuenta no está activa o la sesión no es válida.' USING ERRCODE='42501';
  END IF;
  v_rol := private.rol_finca(p_finca_id);
  IF v_rol IS NULL OR (p_admin AND v_rol<>'ADMINISTRADOR') THEN
    RAISE EXCEPTION 'No tienes permisos para esta operación en la finca.' USING ERRCODE='42501';
  END IF;
  IF p_activa AND NOT EXISTS(SELECT 1 FROM public.finca f WHERE f.id=p_finca_id AND f.activo) THEN
    RAISE EXCEPTION 'La finca está inactiva; solo puedes consultar el historial.' USING ERRCODE='42501';
  END IF;
  RETURN auth.uid();
END $$;

-- RF-UC14-01: comprobación online para el proveedor de sesión y el formulario de acceso.
CREATE OR REPLACE FUNCTION public.verificar_cuenta_activa() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT private.cuenta_activa(); $$;
-- RF-UC14-03 y RF-TR-03: revalida la finca justo antes de una descarga de cualquier sección.
CREATE OR REPLACE FUNCTION public.autorizar_reporte_finca(p_finca_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN PERFORM private.validar_acceso_finca(p_finca_id,true); END $$;
-- RF-UC14-03: mantiene el contrato usado por políticas anteriores con cuenta/rol vigentes.
CREATE OR REPLACE FUNCTION public.es_miembro_finca(p_finca_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.rol_finca(p_finca_id) IS NOT NULL;
$$;

-- RF-UC14-03: nunca permite consultar las fincas de una cuenta distinta de la sesión.
CREATE OR REPLACE FUNCTION public.obtener_fincas_usuario(p_usuario_id uuid DEFAULT NULL)
RETURNS TABLE(finca_id uuid,nombre varchar,ubicacion text,activo boolean,rol_id uuid,rol_nombre varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.cuenta_activa() OR coalesce(p_usuario_id,auth.uid()) IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No puedes consultar las fincas de esta cuenta.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT f.id,f.nombre,f.ubicacion,f.activo,r.id,r.nombre
    FROM public.usuario_finca uf JOIN public.finca f ON f.id=uf.finca_id
    JOIN public.roles r ON r.id=uf.rol_id
    WHERE uf.usuario_id=auth.uid() AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO') ORDER BY f.nombre;
END $$;

-- RF-UC03-01/RF-UC14-03: toda cuenta activa puede crear su finca; será su administrador.
CREATE OR REPLACE FUNCTION public.crear_finca(p_nombre text,p_ubicacion text DEFAULT NULL)
RETURNS public.finca LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca public.finca;
BEGIN
  IF NOT private.cuenta_activa() THEN RAISE EXCEPTION 'La cuenta no está activa.' USING ERRCODE='42501'; END IF;
  IF coalesce(btrim(p_nombre),'')='' THEN RAISE EXCEPTION 'El nombre de la finca es obligatorio'; END IF;
  INSERT INTO public.finca(nombre,ubicacion,activo) VALUES(btrim(p_nombre),nullif(btrim(p_ubicacion),''),true) RETURNING * INTO v_finca;
  INSERT INTO public.usuario_finca(usuario_id,finca_id,rol_id)
    SELECT auth.uid(),v_finca.id,r.id FROM public.roles r WHERE r.nombre='ADMINISTRADOR';
  RETURN v_finca;
END $$;

-- RF-UC14-03: el catálogo de roles contiene solo los dos nombres acordados.
CREATE OR REPLACE FUNCTION public.obtener_roles()
RETURNS TABLE(id uuid,nombre varchar,descripcion text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.cuenta_activa() THEN RAISE EXCEPTION 'La cuenta no está activa.' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT r.id,r.nombre,r.descripcion FROM public.roles r
    WHERE r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO') ORDER BY r.nombre;
END $$;

-- RF-UC14-03: la administración del equipo requiere administrador de esa finca.
CREATE OR REPLACE FUNCTION public.obtener_miembros_finca(p_finca_id uuid)
RETURNS TABLE(usuario_id uuid,correo varchar,nombre_completo varchar,rol_id uuid,rol_nombre varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id,true);
  RETURN QUERY SELECT uf.usuario_id,p.correo,p.nombre_completo,r.id,r.nombre FROM public.usuario_finca uf
    JOIN public.perfil_usuario p ON p.id=uf.usuario_id JOIN public.roles r ON r.id=uf.rol_id
    WHERE uf.finca_id=p_finca_id ORDER BY p.nombre_completo;
END $$;

-- RF-UC14-03: cierra la lectura de tareas ajenas también al invocar directamente la RPC.
CREATE OR REPLACE FUNCTION public.obtener_tareas_finca(p_finca_id uuid)
RETURNS TABLE(id uuid,titulo text,descripcion text,estado text,fecha_limite text,asignada_a uuid,asignada_nombre text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_usuario uuid;
BEGIN
  v_usuario:=private.validar_acceso_finca(p_finca_id);
  RETURN QUERY SELECT t.id,t.titulo::text,coalesce(t.descripcion,'')::text,coalesce(t.estado,'PENDIENTE')::text,
    coalesce(t.fecha_limite::text,''),t.asignada_a,coalesce(p.nombre_completo,p.correo,'Toda la finca')::text
    FROM public.tarea_campo t LEFT JOIN public.perfil_usuario p ON p.id=t.asignada_a
    WHERE t.finca_id=p_finca_id AND (private.rol_finca(p_finca_id)='ADMINISTRADOR' OR t.asignada_a=v_usuario)
    ORDER BY CASE WHEN t.estado='PENDIENTE' THEN 0 ELSE 1 END,t.fecha_limite NULLS LAST,t.created_at DESC;
END $$;

-- RF-UC14-03/RF-UC11-02: solo el administrador o el responsable pueden actualizar el estado.
CREATE OR REPLACE FUNCTION public.marcar_tarea_estado(p_id uuid,p_estado text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tarea public.tarea_campo; v_usuario uuid;
BEGIN
  SELECT * INTO v_tarea FROM public.tarea_campo WHERE id=p_id FOR UPDATE;
  v_usuario:=private.validar_acceso_finca(v_tarea.finca_id,false,true);
  IF private.rol_finca(v_tarea.finca_id)='PERSONAL_CAMPO' AND v_tarea.asignada_a IS DISTINCT FROM v_usuario THEN
    RAISE EXCEPTION 'Solo puedes actualizar tus tareas asignadas.' USING ERRCODE='42501';
  END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('PENDIENTE','COMPLETADA') THEN RAISE EXCEPTION 'Estado de tarea inválido.'; END IF;
  IF v_tarea.estado=p_estado THEN RETURN; END IF;
  UPDATE public.tarea_campo SET estado=p_estado WHERE id=p_id;
  INSERT INTO public.historial_tarea(tarea_id,cambiado_por,estado_anterior,estado_nuevo,observaciones,fecha_cambio)
    VALUES(p_id,v_usuario,v_tarea.estado,p_estado,'Actualizado desde BoviTrack',now());
END $$;
-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.actualizar_finca(p_finca_id uuid, p_nombre character varying, p_ubicacion text, p_activo boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Verificar que el usuario actual es ADMINISTRADOR de la finca
  PERFORM private.validar_acceso_finca(p_finca_id,true,false);

  IF p_activo IS FALSE AND EXISTS(SELECT 1 FROM public.bovino b WHERE b.finca_id=p_finca_id AND b.estado='ACTIVO') THEN
    RAISE EXCEPTION 'No se puede desactivar una finca con toros activos.';
  END IF;
  UPDATE public.finca
  SET
    nombre    = p_nombre,
    ubicacion = p_ubicacion,
    activo    = p_activo
  WHERE id = p_finca_id
  RETURNING json_build_object(
    'id',        id,
    'nombre',    nombre,
    'ubicacion', ubicacion,
    'activo',    activo
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'No se encontró la finca con ID %.', p_finca_id;
  END IF;

  RETURN v_result;
END;
$function$;


-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.agregar_miembro_finca(p_finca_id uuid, p_correo character varying, p_rol_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_usuario_id UUID;
BEGIN
  -- Verificar que el usuario actual es ADMINISTRADOR de la finca
  PERFORM private.validar_acceso_finca(p_finca_id,true,true);

  IF NOT EXISTS(SELECT 1 FROM public.roles r WHERE r.id=p_rol_id AND r.nombre='ADMINISTRADOR') THEN
    RAISE EXCEPTION 'PERSONAL_CAMPO debe ingresar mediante invitación.' USING ERRCODE='42501';
  END IF;
  -- Buscar el usuario por correo en perfil_usuario
  SELECT id INTO v_usuario_id
  FROM public.perfil_usuario
  WHERE lower(correo) = lower(btrim(p_correo)) AND activo
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario registrado con el correo %.', p_correo;
  END IF;

  -- Insertar o actualizar si ya existe la relación
  INSERT INTO public.usuario_finca (usuario_id, finca_id, rol_id)
  VALUES (v_usuario_id, p_finca_id, p_rol_id)
  ON CONFLICT (usuario_id, finca_id)
  DO UPDATE SET rol_id = EXCLUDED.rol_id;

  RETURN json_build_object(
    'success',    true,
    'usuario_id', v_usuario_id
  );
END;
$function$;


-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.eliminar_miembro_finca(p_finca_id uuid, p_usuario_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Verificar que el usuario actual es ADMINISTRADOR de la finca
  PERFORM private.validar_acceso_finca(p_finca_id,true,true);

  -- El administrador no puede eliminarse a sí mismo
  IF p_usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminarte a ti mismo de la finca.';
  END IF;

  DELETE FROM public.usuario_finca
  WHERE finca_id  = p_finca_id
    AND usuario_id = p_usuario_id;

  RETURN json_build_object('success', true);
END;
$function$;


-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.crear_invitacion_finca(p_finca_id uuid, p_rol_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_token text;
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id,true,true);

  IF NOT EXISTS(SELECT 1 FROM public.roles r WHERE r.id=p_rol_id AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO')) THEN
    RAISE EXCEPTION 'Rol de invitación inválido.';
  END IF;
  INSERT INTO public.invitacion_finca (finca_id, rol_id, creado_por)
  VALUES (p_finca_id, p_rol_id, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$function$;


-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.crear_tarea_finca(p_finca_id uuid, p_titulo text, p_descripcion text DEFAULT NULL::text, p_fecha_limite date DEFAULT NULL::date, p_asignada_a uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_id uuid := gen_random_uuid();
  v_creada_por uuid := auth.uid();
  v_resultado jsonb;
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id,true,true);
  IF coalesce(btrim(p_titulo),'')='' THEN RAISE EXCEPTION 'Indica el título de la tarea.'; END IF;
  IF p_asignada_a IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.usuario_finca uf JOIN public.perfil_usuario p ON p.id=uf.usuario_id AND p.activo
    JOIN public.roles r ON r.id=uf.rol_id AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO')
    WHERE uf.usuario_id=p_asignada_a AND uf.finca_id=p_finca_id) THEN
    RAISE EXCEPTION 'El responsable no tiene acceso activo a la finca.';
  END IF;
  INSERT INTO public.tarea_campo (
    id,
    finca_id,
    titulo,
    descripcion,
    fecha_limite,
    asignada_a,
    creada_por,
    estado,
    created_at
  ) VALUES (
    v_id,
    p_finca_id,
    trim(p_titulo),
    nullif(trim(p_descripcion), ''),
    p_fecha_limite,
    p_asignada_a,
    v_creada_por,
    'PENDIENTE',
    now()
  );

  SELECT jsonb_build_object(
    'id', tc.id,
    'titulo', tc.titulo,
    'descripcion', coalesce(tc.descripcion, ''),
    'estado', tc.estado,
    'fecha_limite', coalesce(tc.fecha_limite::text, ''),
    'asignada_a', tc.asignada_a,
    'asignada_nombre', coalesce(p.nombre_completo, p.correo, 'Toda la finca')
  )
  INTO v_resultado
  FROM public.tarea_campo tc
  LEFT JOIN public.perfil_usuario p ON p.id = tc.asignada_a
  WHERE tc.id = v_id;

  RETURN v_resultado;
END;
$function$;


-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.obtener_registros_sanitarios_finca(p_finca_id uuid)
 RETURNS TABLE(id uuid, bovino_id uuid, tipo text, producto text, dosis text, fecha date, proxima date, responsable text, observaciones text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id);
  RETURN QUERY SELECT 
    rs.id,
    rs.bovino_id,
    CASE 
      WHEN rs.observaciones ~ '^\[SANIDAD:([A-Z]+)\]' THEN
        substring(rs.observaciones from '^\[SANIDAD:([A-Z]+)\]')
      WHEN i.tipo = 'VACUNA' THEN 'VACUNACION'
      WHEN i.tipo = 'MEDICAMENTO' THEN 'TRATAMIENTO'
      ELSE 'TRATAMIENTO'
    END::text AS tipo,
    coalesce(i.nombre, 'Sin insumo')::text AS producto,
    (rs.dosis_aplicada::text || ' ' || coalesce(i.unidad_medida, 'ml'))::text AS dosis,
    rs.fecha_aplicacion AS fecha,
    rs.proxima_aplicacion AS proxima,
    coalesce(p.nombre_completo, p.correo, 'Personal')::text AS responsable,
    trim(regexp_replace(coalesce(rs.observaciones, ''), '^\[SANIDAD:[A-Z]+\]\s*', ''))::text AS observaciones
  FROM public.registro_sanitario rs
  JOIN public.bovino b ON b.id = rs.bovino_id
  LEFT JOIN public.insumo i ON i.id = rs.insumo_id
  LEFT JOIN public.perfil_usuario p ON p.id = rs.aplicado_por
  WHERE b.finca_id = p_finca_id
  ORDER BY rs.fecha_aplicacion DESC, rs.created_at DESC;
END;
$function$;


-- RF-UC14-03: autoriza la operación existente con cuenta, rol y finca vigentes.
CREATE OR REPLACE FUNCTION public.registrar_aplicacion_sanitaria(p_bovino_id uuid, p_tipo text, p_producto text, p_dosis text, p_fecha_aplicacion date DEFAULT CURRENT_DATE, p_proxima_aplicacion date DEFAULT NULL::date, p_responsable text DEFAULT NULL::text, p_observaciones text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_finca_id uuid;
  v_insumo_id uuid;
  v_usuario_id uuid := auth.uid();
  v_dosis_num numeric;
  v_insumo_tipo varchar(50);
  v_obs_guardar text;
  v_registro_id uuid := gen_random_uuid();
  v_resultado jsonb;
BEGIN
  -- Obtener la finca a la que pertenece el bovino
  SELECT finca_id INTO v_finca_id
  FROM public.bovino
  WHERE id = p_bovino_id;

  IF v_finca_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el bovino especificado.';
  END IF;

  PERFORM private.validar_acceso_finca(v_finca_id,false,true);
  IF NOT EXISTS(SELECT 1 FROM public.bovino b WHERE b.id=p_bovino_id AND b.estado='ACTIVO') THEN
    RAISE EXCEPTION 'El toro no está activo.';
  END IF;
  IF coalesce(btrim(p_producto),'')='' OR p_fecha_aplicacion IS NULL OR NOT isfinite(p_fecha_aplicacion)
    OR (p_proxima_aplicacion IS NOT NULL AND NOT isfinite(p_proxima_aplicacion)) THEN
    RAISE EXCEPTION 'Completa el producto y fechas válidas.';
  END IF;
  -- Mapear tipo al valor permitido por el check constraint "insumo_tipo_check"
  IF upper(trim(p_tipo)) IN ('VACUNACION', 'VACUNA') THEN
    v_insumo_tipo := 'VACUNA';
  ELSIF upper(trim(p_tipo)) IN ('DESPARASITACION', 'VITAMINIZACION', 'TRATAMIENTO', 'MEDICAMENTO') THEN
    v_insumo_tipo := 'MEDICAMENTO';
  ELSE
    RAISE EXCEPTION 'Tipo sanitario inválido.';
  END IF;

  IF coalesce(btrim(p_dosis),'') !~ '^[0-9]+([.,][0-9]+)?$' THEN RAISE EXCEPTION 'Indica una dosis positiva.'; END IF;
  v_dosis_num := replace(btrim(p_dosis),',','.')::numeric;
  IF v_dosis_num<=0 THEN RAISE EXCEPTION 'Indica una dosis positiva.'; END IF;

  -- Buscar si el insumo ya existe en la finca con ese nombre
  SELECT id INTO v_insumo_id
  FROM public.insumo
  WHERE finca_id = v_finca_id
    AND lower(trim(nombre)) = lower(trim(p_producto))
  LIMIT 1;

  IF v_insumo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.insumo i WHERE i.id=v_insumo_id AND i.activo AND i.tipo=v_insumo_tipo) THEN
    RAISE EXCEPTION 'El producto está inactivo o su categoría no corresponde a la aplicación.';
  END IF;
  -- Si el insumo no existe en el catálogo de la finca, lo creamos con el tipo válido
  IF v_insumo_id IS NULL THEN
    PERFORM private.validar_acceso_finca(v_finca_id,true,true);
    v_insumo_id := gen_random_uuid();
    INSERT INTO public.insumo (
      id,
      finca_id,
      nombre,
      tipo,
      unidad_medida,
      costo_unitario,
      activo,
      created_at
    ) VALUES (
      v_insumo_id,
      v_finca_id,
      trim(p_producto),
      v_insumo_tipo,
      'ml',
      0,
      true,
      now()
    );
  END IF;

  -- Guardar prefijo [SANIDAD:TIPO] en observaciones para distinguir
  -- entre DESPARASITACION, VITAMINIZACION, TRATAMIENTO y VACUNACION
  v_obs_guardar := '[SANIDAD:' || upper(trim(p_tipo)) || ']' ||
    CASE 
      WHEN p_observaciones IS NOT NULL AND trim(p_observaciones) <> '' 
      THEN ' ' || trim(p_observaciones)
      ELSE ''
    END;

  -- Insertar el registro sanitario en la tabla normalizada
  INSERT INTO public.registro_sanitario (
    id,
    bovino_id,
    insumo_id,
    aplicado_por,
    dosis_aplicada,
    fecha_aplicacion,
    proxima_aplicacion,
    observaciones,
    created_at
  ) VALUES (
    v_registro_id,
    p_bovino_id,
    v_insumo_id,
    v_usuario_id,
    v_dosis_num,
    coalesce(p_fecha_aplicacion, CURRENT_DATE),
    p_proxima_aplicacion,
    nullif(trim(v_obs_guardar), ''),
    now()
  );

  -- Retornar el registro armado con la información del insumo y responsable
  SELECT jsonb_build_object(
    'id', rs.id,
    'bovino_id', rs.bovino_id,
    'tipo', upper(trim(p_tipo)),
    'producto', coalesce(i.nombre, p_producto),
    'dosis', rs.dosis_aplicada::text || ' ' || coalesce(i.unidad_medida, 'ml'),
    'fecha', rs.fecha_aplicacion::text,
    'proxima', coalesce(rs.proxima_aplicacion::text, ''),
    'responsable', coalesce(p.nombre_completo, p.correo, p_responsable, 'Personal'),
    'observaciones', coalesce(nullif(trim(p_observaciones), ''), '')
  )
  INTO v_resultado
  FROM public.registro_sanitario rs
  LEFT JOIN public.insumo i ON i.id = rs.insumo_id
  LEFT JOIN public.perfil_usuario p ON p.id = rs.aplicado_por
  WHERE rs.id = v_registro_id;

  RETURN v_resultado;
END;
$function$;

-- RF-UC14-03: consume una invitación una sola vez, con cuenta y finca activas.
CREATE OR REPLACE FUNCTION public.aceptar_invitacion_finca(p_token text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_inv public.invitacion_finca; v_farm public.finca;
BEGIN
  IF NOT private.cuenta_activa() THEN RAISE EXCEPTION 'La cuenta no está activa.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_inv FROM public.invitacion_finca WHERE token=p_token FOR UPDATE;
  IF NOT FOUND OR v_inv.expira_en<=now() OR v_inv.usado_en IS NOT NULL THEN
    RAISE EXCEPTION 'La invitación no es válida, expiró o ya fue utilizada.';
  END IF;
  -- Una invitación no conserva privilegios de un emisor que perdió su autorización.
  IF NOT EXISTS(SELECT 1 FROM public.usuario_finca uf JOIN public.perfil_usuario p ON p.id=uf.usuario_id AND p.activo
    JOIN public.roles r ON r.id=uf.rol_id AND r.nombre='ADMINISTRADOR'
    WHERE uf.usuario_id=v_inv.creado_por AND uf.finca_id=v_inv.finca_id) THEN
    RAISE EXCEPTION 'El emisor ya no puede invitar a esta finca.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_farm FROM public.finca WHERE id=v_inv.finca_id AND activo FOR SHARE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.roles r WHERE r.id=v_inv.rol_id AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO')) THEN
    RAISE EXCEPTION 'La finca o el rol de la invitación no están disponibles.';
  END IF;
  INSERT INTO public.usuario_finca(finca_id,usuario_id,rol_id) VALUES(v_inv.finca_id,auth.uid(),v_inv.rol_id)
    ON CONFLICT(usuario_id,finca_id) DO NOTHING;
  UPDATE public.invitacion_finca SET usado_en=now(),usado_por=auth.uid() WHERE id=v_inv.id;
  RETURN json_build_object('finca_id',v_farm.id,'nombre',v_farm.nombre,'ubicacion',v_farm.ubicacion,'activo',v_farm.activo);
END $$;

-- Integra inventario con la misma autorización sin cambiar sus contratos RPC.
CREATE OR REPLACE FUNCTION private.validar_acceso_inventario(
  p_finca_id uuid,p_requiere_admin boolean,p_requiere_activa boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN RETURN private.validar_acceso_finca(p_finca_id,p_requiere_admin,p_requiere_activa); END $$;

-- RF-UC14-03: todas las tablas de la aplicación parten sin permisos directos.
-- Se revocan también grants de columna: REVOKE de tabla por sí solo no los elimina.
DO $$
DECLARE t text; cols text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles','perfil_usuario','usuario_finca','invitacion_finca','finca','bovino',
    'pesaje','registro_sanitario','tarea_campo','historial_tarea','compra_subasta','movimiento_bovino',
    'registro_venta','registro_mortalidad','insumo','movimiento_inventario'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
    SELECT string_agg(quote_ident(a.attname),',') INTO cols FROM pg_attribute a
      WHERE a.attrelid=format('public.%I',t)::regclass AND a.attnum>0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE SELECT(%s),INSERT(%s),UPDATE(%s),REFERENCES(%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,t);
    END LOOP;
  END LOOP;
END $$;
-- Lecturas operativas: sin costos ni información de compras en bovino.
GRANT SELECT(id,finca_id,numero_diio,identificador_interno,nombre,raza,color,sexo,estado,
  fecha_nacimiento,fecha_ingreso,created_at) ON public.bovino TO authenticated;
GRANT INSERT(finca_id,numero_diio,identificador_interno,nombre,raza,color,sexo,fecha_nacimiento,fecha_ingreso)
  ON public.bovino TO authenticated;
GRANT UPDATE(identificador_interno,nombre,raza,color,estado) ON public.bovino TO authenticated;
GRANT SELECT ON public.pesaje,public.registro_sanitario TO authenticated;
-- Las relaciones PostgREST de alertas sanitarias solo necesitan estas columnas de bovino.
CREATE POLICY acceso_bovino_consulta ON public.bovino FOR SELECT TO authenticated
  USING(private.rol_finca(finca_id) IS NOT NULL);
CREATE POLICY acceso_bovino_alta ON public.bovino FOR INSERT TO authenticated
  WITH CHECK(private.rol_finca(finca_id)='ADMINISTRADOR' AND estado='ACTIVO'
    AND EXISTS(SELECT 1 FROM public.finca f WHERE f.id=finca_id AND f.activo));
CREATE POLICY acceso_bovino_edicion ON public.bovino FOR UPDATE TO authenticated
  USING(private.rol_finca(finca_id)='ADMINISTRADOR' AND EXISTS(SELECT 1 FROM public.finca f WHERE f.id=finca_id AND f.activo))
  WITH CHECK(private.rol_finca(finca_id)='ADMINISTRADOR' AND EXISTS(SELECT 1 FROM public.finca f WHERE f.id=finca_id AND f.activo));
CREATE POLICY acceso_pesaje_consulta ON public.pesaje FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.bovino b WHERE b.id=bovino_id AND private.rol_finca(b.finca_id) IS NOT NULL));
CREATE POLICY acceso_sanidad_consulta ON public.registro_sanitario FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.bovino b WHERE b.id=bovino_id AND private.rol_finca(b.finca_id) IS NOT NULL));
-- Es necesaria la lectura de finca para la comprobación RLS de altas de bovinos.
GRANT SELECT ON public.finca TO authenticated;
CREATE POLICY acceso_finca_consulta ON public.finca FOR SELECT TO authenticated USING(private.rol_finca(id) IS NOT NULL);

-- Evita transiciones de venta/baja y traslados al editar la ficha directamente.
CREATE OR REPLACE FUNCTION private.validar_edicion_bovino() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.finca_id IS DISTINCT FROM OLD.finca_id THEN RAISE EXCEPTION 'Usa el flujo de traslado para cambiar de finca.'; END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado AND
    (OLD.estado NOT IN ('ACTIVO','INACTIVO') OR NEW.estado NOT IN ('ACTIVO','INACTIVO')) THEN
    RAISE EXCEPTION 'La venta o baja requiere registrar su evento.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_edicion_bovino ON public.bovino;
CREATE TRIGGER validar_edicion_bovino BEFORE UPDATE ON public.bovino
  FOR EACH ROW EXECUTE FUNCTION private.validar_edicion_bovino();

-- RF-UC14-03: los datos financieros solo salen mediante una RPC administrativa.
CREATE OR REPLACE FUNCTION public.obtener_costos_bovinos_finca(p_finca_id uuid)
RETURNS TABLE(id uuid,compra_id uuid,precio_compra_kilo numeric,costo_flete_asignado numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id,true);
  RETURN QUERY SELECT b.id,b.compra_id,b.precio_compra_kilo,b.costo_flete_asignado FROM public.bovino b WHERE b.finca_id=p_finca_id;
END $$;

-- El historial sanitario no tiene borrado público. Se conserva para trazabilidad.
REVOKE ALL ON FUNCTION public.eliminar_registro_sanitario(uuid) FROM PUBLIC,anon,authenticated;
-- Los helpers no pueden invocarse por otra vía para modificar datos.
REVOKE ALL ON FUNCTION private.cuenta_activa(),private.rol_finca(uuid),
  private.validar_acceso_finca(uuid,boolean,boolean),private.validar_acceso_inventario(uuid,boolean,boolean),
  private.validar_edicion_bovino(),private.registrar_compra_subasta_impl(text,text,date,numeric,text,jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE USAGE ON SCHEMA private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.rol_finca(uuid) TO authenticated;
-- Necesario para el wrapper SECURITY INVOKER de compras; su cuerpo valida cuenta y cada finca.
GRANT EXECUTE ON FUNCTION private.registrar_compra_subasta_impl(text,text,date,numeric,text,jsonb) TO authenticated;

-- Cierra los grants heredados de las RPC de aplicación, incluidos overloads anteriores.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN SELECT p.oid::regprocedure AS firma FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('verificar_cuenta_activa','autorizar_reporte_finca',
      'obtener_costos_bovinos_finca','es_miembro_finca','obtener_fincas_usuario','crear_finca','actualizar_finca',
      'obtener_roles','obtener_miembros_finca','agregar_miembro_finca','eliminar_miembro_finca','crear_invitacion_finca',
      'aceptar_invitacion_finca','crear_tarea_finca','obtener_tareas_finca','marcar_tarea_estado',
      'obtener_registros_sanitarios_finca','registrar_aplicacion_sanitaria','registrar_compra_subasta',
      'eliminar_registro_sanitario','handle_new_user') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.firma);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.verificar_cuenta_activa(),public.autorizar_reporte_finca(uuid),
  public.obtener_costos_bovinos_finca(uuid),public.es_miembro_finca(uuid),public.obtener_fincas_usuario(uuid),
  public.crear_finca(text,text),public.actualizar_finca(uuid,varchar,text,boolean),public.obtener_roles(),
  public.obtener_miembros_finca(uuid),public.agregar_miembro_finca(uuid,varchar,uuid),public.eliminar_miembro_finca(uuid,uuid),
  public.crear_invitacion_finca(uuid,uuid),public.aceptar_invitacion_finca(text),public.crear_tarea_finca(uuid,text,text,date,uuid),
  public.obtener_tareas_finca(uuid),public.marcar_tarea_estado(uuid,text),public.obtener_registros_sanitarios_finca(uuid),
  public.registrar_aplicacion_sanitaria(uuid,text,text,text,date,date,text,text),
  public.registrar_compra_subasta(text,text,date,numeric,text,jsonb) TO authenticated;

-- RF-TR-02: autoriza, aplica y confirma cada captura en una sola transacción idempotente.
CREATE OR REPLACE FUNCTION public.procesar_operacion_offline(
  p_operacion_id uuid, p_finca_id uuid, p_tipo text, p_datos jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_rol text;
  v_anterior private.operacion_offline%ROWTYPE;
  v_resultado jsonb;
  v_bovino uuid;
  v_peso numeric;
  v_fecha date;
  v_dosis numeric;
  v_asignada uuid;
BEGIN
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'Inicia sesión para sincronizar.' USING ERRCODE = '42501'; END IF;
  IF p_operacion_id IS NULL OR p_finca_id IS NULL OR p_tipo IS NULL
    OR p_tipo NOT IN ('weighing','sanitary','inventory','task')
    OR p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' THEN
    RAISE EXCEPTION 'La captura offline no es válida.';
  END IF;
  IF NOT private.cuenta_activa() THEN RAISE EXCEPTION 'CUENTA_INACTIVA: La cuenta no está activa.' USING ERRCODE='42501'; END IF;
  -- Se verifica la autorización vigente, también cuando el dispositivo reintenta.
  SELECT r.nombre INTO v_rol
    FROM public.usuario_finca uf
    JOIN public.perfil_usuario u ON u.id=uf.usuario_id AND u.activo
    JOIN public.finca f ON f.id=uf.finca_id AND f.activo
    JOIN public.roles r ON r.id=uf.rol_id
    WHERE uf.usuario_id=v_usuario AND uf.finca_id=p_finca_id FOR SHARE OF uf,u,f,r;
  IF v_rol IS NULL OR v_rol NOT IN ('ADMINISTRADOR','PERSONAL_CAMPO') THEN
    RAISE EXCEPTION 'Tu cuenta, rol o finca ya no permite sincronizar esta captura.' USING ERRCODE = '42501';
  END IF;

  -- El conflicto de clave espera al primer envío concurrente; un fallo revierte también este registro.
  INSERT INTO private.operacion_offline(usuario_id,operacion_id,finca_id,tipo,datos)
    VALUES(v_usuario,p_operacion_id,p_finca_id,p_tipo,p_datos) ON CONFLICT DO NOTHING;
  SELECT * INTO v_anterior FROM private.operacion_offline
    WHERE usuario_id=v_usuario AND operacion_id=p_operacion_id FOR UPDATE;
  IF v_anterior.finca_id <> p_finca_id OR v_anterior.tipo <> p_tipo OR v_anterior.datos <> p_datos THEN
    RAISE EXCEPTION 'El identificador ya corresponde a otra captura. No cambies sus datos al reintentar.';
  END IF;
  IF v_anterior.resultado IS NOT NULL THEN RETURN v_anterior.resultado; END IF;

  IF p_tipo IN ('weighing','sanitary') THEN
    v_bovino := (p_datos->>'bovino_id')::uuid;
    PERFORM 1 FROM public.bovino WHERE id=v_bovino AND finca_id=p_finca_id AND estado='ACTIVO' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El toro no está activo en la finca de la captura.'; END IF;
  END IF;

  CASE p_tipo
    WHEN 'weighing' THEN
      v_peso := (p_datos->>'peso_kg')::numeric;
      v_fecha := (p_datos->>'fecha_pesaje')::date;
      IF v_peso IS NULL OR v_peso <= 0 OR v_peso::text IN ('NaN','Infinity','-Infinity')
        OR v_fecha IS NULL OR NOT isfinite(v_fecha) THEN
        RAISE EXCEPTION 'Ingresa un peso positivo y una fecha válida.';
      END IF;
      INSERT INTO public.pesaje(id,bovino_id,registrado_por,peso_kg,fecha_pesaje,es_inicial)
        VALUES(p_operacion_id,v_bovino,v_usuario,v_peso,v_fecha,false)
        RETURNING jsonb_build_object('id',id,'bovino_id',bovino_id,'peso_kg',peso_kg,'fecha_pesaje',fecha_pesaje) INTO v_resultado;
    WHEN 'sanitary' THEN
      v_fecha := (p_datos->>'fecha')::date;
      v_dosis := (p_datos->>'dosis')::numeric;
      IF coalesce(btrim(p_datos->>'producto'),'')='' OR p_datos->>'tipo' IS NULL
        OR p_datos->>'tipo' NOT IN ('VACUNACION','DESPARASITACION','VITAMINIZACION','TRATAMIENTO')
        OR v_dosis IS NULL OR v_dosis <= 0 OR v_dosis::text IN ('NaN','Infinity','-Infinity')
        OR v_fecha IS NULL OR NOT isfinite(v_fecha) THEN
        RAISE EXCEPTION 'Completa producto, dosis positiva y fecha válida.';
      END IF;
      IF p_datos->>'proxima' IS NOT NULL AND NOT isfinite((p_datos->>'proxima')::date) THEN
        RAISE EXCEPTION 'La próxima aplicación debe tener una fecha válida.';
      END IF;
      v_resultado := public.registrar_aplicacion_sanitaria(v_bovino,p_datos->>'tipo',
        p_datos->>'producto',p_datos->>'dosis',v_fecha,(p_datos->>'proxima')::date,
        NULL,p_datos->>'observaciones');
    WHEN 'inventory' THEN
      PERFORM 1 FROM public.insumo WHERE id=(p_datos->>'insumo_id')::uuid AND finca_id=p_finca_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'El insumo no pertenece a la finca de la captura.'; END IF;
      v_resultado := public.registrar_movimiento_inventario((p_datos->>'insumo_id')::uuid,
        p_datos->>'tipo',(p_datos->>'cantidad')::numeric,(p_datos->>'fecha')::date,p_datos->>'observaciones');
    WHEN 'task' THEN
      SELECT asignada_a INTO v_asignada FROM public.tarea_campo
        WHERE id=(p_datos->>'id')::uuid AND finca_id=p_finca_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'La tarea no pertenece a la finca de la captura.'; END IF;
      IF v_rol = 'PERSONAL_CAMPO' AND v_asignada IS DISTINCT FROM v_usuario THEN
        RAISE EXCEPTION 'Solo puedes actualizar tus tareas asignadas.' USING ERRCODE='42501';
      END IF;
      IF p_datos->>'estado' IS NULL OR p_datos->>'estado' NOT IN ('PENDIENTE','COMPLETADA') THEN
        RAISE EXCEPTION 'El estado de la tarea no es válido.';
      END IF;
      PERFORM public.marcar_tarea_estado((p_datos->>'id')::uuid,p_datos->>'estado');
      v_resultado := jsonb_build_object('id',p_datos->>'id','estado',p_datos->>'estado');
  END CASE;

  IF v_resultado IS NULL THEN RAISE EXCEPTION 'No se recibió confirmación de la operación.'; END IF;
  UPDATE private.operacion_offline SET resultado=v_resultado
    WHERE usuario_id=v_usuario AND operacion_id=p_operacion_id;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.procesar_operacion_offline(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.procesar_operacion_offline(uuid,uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
