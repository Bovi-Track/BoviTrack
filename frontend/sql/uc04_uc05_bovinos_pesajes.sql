-- RF-UC04-01 y RF-UC05-01: alta, edición y consulta de toros y pesajes por RPC.
-- Aplicar después de uc14_control_acceso.sql. El cliente no lee ni escribe bovino, pesaje ni sanidad.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.bovino_json(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'finca_id', b.finca_id,
    'fecha_ingreso', b.fecha_ingreso,
    'numero_diio', b.numero_diio,
    'identificador_interno', b.identificador_interno,
    'nombre', b.nombre,
    'raza', b.raza,
    'color', b.color,
    'sexo', b.sexo,
    'estado', b.estado
  )
  FROM public.bovino b
  WHERE b.id = p_id;
$$;

CREATE OR REPLACE FUNCTION private.pesaje_json(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'bovino_id', p.bovino_id,
    'peso_kg', p.peso_kg,
    'fecha_pesaje', p.fecha_pesaje,
    'es_inicial', p.es_inicial,
    'created_at', p.created_at
  )
  FROM public.pesaje p
  WHERE p.id = p_id;
$$;

-- RF-UC04-01: lista los toros de una finca autorizada para la sesión.
CREATE OR REPLACE FUNCTION public.obtener_bovinos_finca(p_finca_id uuid)
RETURNS TABLE(
  id uuid,
  finca_id uuid,
  fecha_ingreso date,
  numero_diio text,
  identificador_interno text,
  nombre text,
  raza text,
  color text,
  sexo text,
  estado text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id, false, false);
  RETURN QUERY
  SELECT b.id, b.finca_id, b.fecha_ingreso, b.numero_diio::text, b.identificador_interno::text,
    b.nombre::text, b.raza::text, b.color::text, b.sexo::text, b.estado::text
  FROM public.bovino b
  WHERE b.finca_id = p_finca_id
  ORDER BY b.created_at DESC;
END;
$$;

-- RF-UC04-01: da de alta uno o varios toros en fincas donde el usuario es administrador.
CREATE OR REPLACE FUNCTION public.registrar_bovinos(p_bovinos jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_item jsonb;
  v_finca_id uuid;
  v_diio text;
  v_interno text;
  v_sexo text;
  v_nombre text;
  v_raza text;
  v_color text;
  v_fecha_nacimiento date;
  v_fecha_ingreso date;
  v_id uuid;
  v_resultado jsonb := '[]'::jsonb;
BEGIN
  IF p_bovinos IS NULL OR jsonb_typeof(p_bovinos) <> 'array' OR jsonb_array_length(p_bovinos) = 0 THEN
    RAISE EXCEPTION 'La lista de bovinos es obligatoria.';
  END IF;

  FOR v_item IN
    SELECT elemento.value
    FROM jsonb_array_elements(p_bovinos) WITH ORDINALITY AS elemento(value, posicion)
    ORDER BY elemento.posicion
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Cada bovino debe ser un objeto.';
    END IF;

    v_finca_id := nullif(v_item->>'finca_id', '')::uuid;
    v_diio := nullif(btrim(v_item->>'numero_diio'), '');
    v_interno := nullif(btrim(v_item->>'identificador_interno'), '');
    v_sexo := v_item->>'sexo';
    v_nombre := nullif(btrim(v_item->>'nombre'), '');
    v_raza := nullif(btrim(v_item->>'raza'), '');
    v_color := nullif(btrim(v_item->>'color'), '');
    v_fecha_nacimiento := nullif(v_item->>'fecha_nacimiento', '')::date;
    v_fecha_ingreso := nullif(v_item->>'fecha_ingreso', '')::date;

    IF v_finca_id IS NULL OR v_interno IS NULL OR v_sexo IS NULL OR v_fecha_ingreso IS NULL THEN
      RAISE EXCEPTION 'Faltan finca, identificador interno, sexo o fecha de ingreso.';
    END IF;

    PERFORM private.validar_acceso_finca(v_finca_id, true, true);

    IF v_sexo NOT IN ('MACHO', 'HEMBRA') THEN
      RAISE EXCEPTION 'Sexo de bovino inválido.';
    END IF;

    IF NOT isfinite(v_fecha_ingreso) THEN
      RAISE EXCEPTION 'La fecha de ingreso no es válida.';
    END IF;

    IF v_fecha_nacimiento IS NOT NULL AND (
      NOT isfinite(v_fecha_nacimiento) OR v_fecha_nacimiento > v_fecha_ingreso
    ) THEN
      RAISE EXCEPTION 'La fecha de nacimiento no puede ser posterior al ingreso.';
    END IF;

    INSERT INTO public.bovino (
      finca_id, numero_diio, identificador_interno, nombre, raza, color, sexo,
      fecha_nacimiento, fecha_ingreso, estado
    ) VALUES (
      v_finca_id, v_diio, v_interno, v_nombre, v_raza, v_color, v_sexo,
      v_fecha_nacimiento, v_fecha_ingreso, 'ACTIVO'
    ) RETURNING id INTO v_id;

    v_resultado := v_resultado || jsonb_build_array(private.bovino_json(v_id));
  END LOOP;

  RETURN v_resultado;
END;
$$;

-- RF-UC04-01: actualiza datos básicos; venta, baja y traslado usan sus propias RPC.
CREATE OR REPLACE FUNCTION public.actualizar_bovino(
  p_id uuid,
  p_identificador_interno text,
  p_nombre text,
  p_raza text,
  p_color text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_finca uuid;
  v_interno text := nullif(btrim(p_identificador_interno), '');
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Indica el bovino a editar.';
  END IF;
  IF v_interno IS NULL THEN
    RAISE EXCEPTION 'El identificador interno es obligatorio.';
  END IF;

  SELECT finca_id INTO v_finca FROM public.bovino WHERE id = p_id FOR UPDATE;
  IF v_finca IS NULL THEN
    RAISE EXCEPTION 'No se encontró el bovino especificado.';
  END IF;

  PERFORM private.validar_acceso_finca(v_finca, true, true);

  UPDATE public.bovino
  SET identificador_interno = v_interno,
      nombre = nullif(btrim(p_nombre), ''),
      raza = nullif(btrim(p_raza), ''),
      color = nullif(btrim(p_color), '')
  WHERE id = p_id;

  RETURN private.bovino_json(p_id);
END;
$$;

-- RF-UC05-01: consulta los pesajes de la finca autorizada.
CREATE OR REPLACE FUNCTION public.obtener_pesajes_finca(p_finca_id uuid)
RETURNS TABLE(
  id uuid,
  bovino_id uuid,
  peso_kg numeric,
  fecha_pesaje date,
  es_inicial boolean,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id, false, false);
  RETURN QUERY
  SELECT p.id, p.bovino_id, p.peso_kg, p.fecha_pesaje, p.es_inicial, p.created_at
  FROM public.pesaje p
  JOIN public.bovino b ON b.id = p.bovino_id
  WHERE b.finca_id = p_finca_id
  ORDER BY p.fecha_pesaje ASC, p.created_at ASC;
END;
$$;

-- RF-UC05-01: registra un pesaje de un toro activo. p_id conserva el identificador offline.
CREATE OR REPLACE FUNCTION public.registrar_pesaje(
  p_bovino_id uuid,
  p_peso_kg numeric,
  p_fecha_pesaje date,
  p_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_finca uuid;
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_usuario uuid;
BEGIN
  IF p_bovino_id IS NULL THEN
    RAISE EXCEPTION 'Indica el bovino del pesaje.';
  END IF;

  SELECT finca_id INTO v_finca FROM public.bovino WHERE id = p_bovino_id;
  IF v_finca IS NULL THEN
    RAISE EXCEPTION 'No se encontró el bovino especificado.';
  END IF;

  v_usuario := private.validar_acceso_finca(v_finca, false, true);

  IF NOT EXISTS (
    SELECT 1 FROM public.bovino b WHERE b.id = p_bovino_id AND b.estado = 'ACTIVO'
  ) THEN
    RAISE EXCEPTION 'El toro no está activo.';
  END IF;

  IF p_peso_kg IS NULL OR p_peso_kg <= 0 OR p_peso_kg > 9999.99
    OR p_peso_kg <> round(p_peso_kg, 2)
    OR p_peso_kg::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'El peso debe ser positivo y tener como máximo dos decimales.';
  END IF;

  IF p_fecha_pesaje IS NULL OR NOT isfinite(p_fecha_pesaje) THEN
    RAISE EXCEPTION 'Ingresa un peso positivo y una fecha válida.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pesaje WHERE id = v_id) THEN
    RETURN private.pesaje_json(v_id);
  END IF;

  INSERT INTO public.pesaje (id, bovino_id, registrado_por, peso_kg, fecha_pesaje, es_inicial)
  VALUES (v_id, p_bovino_id, v_usuario, p_peso_kg, p_fecha_pesaje, false);

  RETURN private.pesaje_json(v_id);
END;
$$;

-- RF-TR-02: el pesaje offline pasa por registrar_pesaje en lugar de INSERT directo.
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
  IF NOT private.cuenta_activa() THEN
    RAISE EXCEPTION 'CUENTA_INACTIVA: La cuenta no está activa.' USING ERRCODE='42501';
  END IF;
  SELECT r.nombre INTO v_rol
    FROM public.usuario_finca uf
    JOIN public.perfil_usuario u ON u.id=uf.usuario_id AND u.activo
    JOIN public.finca f ON f.id=uf.finca_id AND f.activo
    JOIN public.roles r ON r.id=uf.rol_id
    WHERE uf.usuario_id=v_usuario AND uf.finca_id=p_finca_id FOR SHARE OF uf,u,f,r;
  IF v_rol IS NULL OR v_rol NOT IN ('ADMINISTRADOR','ADMINISTRADOR DE FINCA','PERSONAL_CAMPO','PERSONAL DE CAMPO') THEN
    RAISE EXCEPTION 'Tu cuenta, rol o finca ya no permite sincronizar esta captura.' USING ERRCODE = '42501';
  END IF;

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
      v_resultado := public.registrar_pesaje(v_bovino, v_peso, v_fecha, p_operacion_id);
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
      IF v_rol IN ('PERSONAL_CAMPO','PERSONAL DE CAMPO') AND v_asignada IS DISTINCT FROM v_usuario THEN
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

REVOKE ALL ON FUNCTION private.bovino_json(uuid), private.pesaje_json(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.obtener_bovinos_finca(uuid),
  public.registrar_bovinos(jsonb),
  public.actualizar_bovino(uuid, text, text, text, text),
  public.obtener_pesajes_finca(uuid),
  public.registrar_pesaje(uuid, numeric, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_bovinos_finca(uuid),
  public.registrar_bovinos(jsonb),
  public.actualizar_bovino(uuid, text, text, text, text),
  public.obtener_pesajes_finca(uuid),
  public.registrar_pesaje(uuid, numeric, date, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.procesar_operacion_offline(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procesar_operacion_offline(uuid, uuid, text, jsonb) TO authenticated;

-- El cliente solo usa RPC: se revocan también SELECT y grants de columna.
DO $$
DECLARE
  t text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bovino', 'pesaje', 'registro_sanitario'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    SELECT string_agg(quote_ident(a.attname), ',') INTO cols
      FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', t)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped;
    IF cols IS NOT NULL THEN
      EXECUTE format(
        'REVOKE SELECT(%s), INSERT(%s), UPDATE(%s), REFERENCES(%s) ON public.%I FROM PUBLIC, anon, authenticated',
        cols, cols, cols, cols, t
      );
    END IF;
  END LOOP;
END $$;
DROP POLICY IF EXISTS acceso_bovino_alta ON public.bovino;
DROP POLICY IF EXISTS acceso_bovino_edicion ON public.bovino;
DROP POLICY IF EXISTS acceso_bovino_consulta ON public.bovino;
DROP POLICY IF EXISTS acceso_pesaje_consulta ON public.pesaje;
DROP POLICY IF EXISTS acceso_sanidad_consulta ON public.registro_sanitario;

NOTIFY pgrst, 'reload schema';
COMMIT;
