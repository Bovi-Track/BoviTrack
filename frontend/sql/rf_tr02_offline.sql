-- RF-TR-02: aplicar una vez (o repetir) desde Supabase SQL Editor como propietario.
-- Requiere uc08_uc09_inventario.sql y las RPC sanitarias/de tareas vigentes.
-- Añade un registro privado de confirmaciones y una RPC; no modifica operaciones previas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.operacion_offline (
  usuario_id uuid NOT NULL REFERENCES public.perfil_usuario(id),
  operacion_id uuid NOT NULL,
  finca_id uuid NOT NULL REFERENCES public.finca(id),
  tipo text NOT NULL,
  datos jsonb NOT NULL,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, operacion_id)
);
-- Sin políticas para clientes: solo la RPC, ejecutada como propietario, usa estas filas.
ALTER TABLE private.operacion_offline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.operacion_offline FROM PUBLIC, anon, authenticated;

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
  -- Se verifica la autorización vigente, también cuando el dispositivo reintenta.
  SELECT upper(btrim(r.nombre)) INTO v_rol
    FROM public.usuario_finca uf
    JOIN public.perfil_usuario u ON u.id=uf.usuario_id AND u.activo
    JOIN public.finca f ON f.id=uf.finca_id AND f.activo
    JOIN public.roles r ON r.id=uf.rol_id
    WHERE uf.usuario_id=v_usuario AND uf.finca_id=p_finca_id FOR SHARE OF uf,u,f,r;
  IF v_rol IS NULL OR v_rol NOT IN ('ADMINISTRADOR','ADMINISTRADOR DE FINCA','PERSONAL_CAMPO','PERSONAL DE CAMPO') THEN
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
REVOKE ALL ON FUNCTION public.procesar_operacion_offline(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.procesar_operacion_offline(uuid,uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
