-- RF-UC11-01: permite editar y reasignar tareas, conservando una bitácora privada.
-- Aplicar después de uc14_control_acceso.sql. No elimina ni modifica registros existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS private.historial_tarea_edicion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id uuid NOT NULL REFERENCES public.tarea_campo(id) ON DELETE RESTRICT,
  cambiado_por uuid REFERENCES public.perfil_usuario(id) ON DELETE SET NULL,
  fecha_cambio timestamptz NOT NULL DEFAULT now(),
  valores_anteriores jsonb NOT NULL,
  valores_nuevos jsonb NOT NULL
);

ALTER TABLE private.historial_tarea_edicion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.historial_tarea_edicion FROM PUBLIC, anon, authenticated;

-- RF-UC11-01: solo el administrador de la finca puede editar y reasignar sus tareas.
CREATE OR REPLACE FUNCTION public.actualizar_tarea_finca(
  p_id uuid,
  p_titulo text,
  p_descripcion text,
  p_fecha_limite date,
  p_asignada_a uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tarea public.tarea_campo;
  v_actualizada public.tarea_campo;
  v_nombre_anterior text;
  v_nombre_nuevo text;
  v_antes jsonb;
  v_despues jsonb;
BEGIN
  SELECT * INTO v_tarea FROM public.tarea_campo WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La tarea no existe.'; END IF;
  PERFORM private.validar_acceso_finca(v_tarea.finca_id,true,true);

  IF coalesce(btrim(p_titulo),'')='' OR char_length(btrim(p_titulo))>120 THEN
    RAISE EXCEPTION 'El título debe tener entre 1 y 120 caracteres.';
  END IF;
  IF char_length(coalesce(p_descripcion,''))>240 THEN
    RAISE EXCEPTION 'El detalle no puede superar 240 caracteres.';
  END IF;
  IF p_asignada_a IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.usuario_finca uf
    JOIN public.perfil_usuario pu ON pu.id=uf.usuario_id AND pu.activo
    JOIN public.roles r ON r.id=uf.rol_id AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO')
    WHERE uf.finca_id=v_tarea.finca_id AND uf.usuario_id=p_asignada_a
  ) THEN
    RAISE EXCEPTION 'El responsable no tiene acceso activo a la finca.';
  END IF;

  SELECT coalesce(p.nombre_completo,p.correo,'Toda la finca') INTO v_nombre_anterior
  FROM public.perfil_usuario p WHERE p.id=v_tarea.asignada_a;
  SELECT coalesce(p.nombre_completo,p.correo,'Toda la finca') INTO v_nombre_nuevo
  FROM public.perfil_usuario p WHERE p.id=p_asignada_a;

  v_antes := jsonb_build_object(
    'titulo',v_tarea.titulo,
    'descripcion',coalesce(v_tarea.descripcion,''),
    'fecha_limite',v_tarea.fecha_limite,
    'responsable',jsonb_build_object('id',v_tarea.asignada_a,'nombre',coalesce(v_nombre_anterior,'Toda la finca'))
  );
  v_despues := jsonb_build_object(
    'titulo',btrim(p_titulo),
    'descripcion',coalesce(nullif(btrim(p_descripcion),''),''),
    'fecha_limite',p_fecha_limite,
    'responsable',jsonb_build_object('id',p_asignada_a,'nombre',coalesce(v_nombre_nuevo,'Toda la finca'))
  );

  IF v_antes IS DISTINCT FROM v_despues THEN
    UPDATE public.tarea_campo SET
      titulo=btrim(p_titulo),
      descripcion=nullif(btrim(p_descripcion),''),
      fecha_limite=p_fecha_limite,
      asignada_a=p_asignada_a
    WHERE id=p_id RETURNING * INTO v_actualizada;

    INSERT INTO private.historial_tarea_edicion(tarea_id,cambiado_por,valores_anteriores,valores_nuevos)
    VALUES(p_id,auth.uid(),v_antes,v_despues);
  ELSE
    v_actualizada := v_tarea;
  END IF;

  SELECT jsonb_build_object(
    'id',t.id,'titulo',t.titulo,'descripcion',coalesce(t.descripcion,''),
    'estado',coalesce(t.estado,'PENDIENTE'),'fecha_limite',coalesce(t.fecha_limite::text,''),
    'asignada_a',t.asignada_a,
    'asignada_nombre',coalesce(p.nombre_completo,p.correo,'Toda la finca')
  ) INTO v_despues
  FROM public.tarea_campo t LEFT JOIN public.perfil_usuario p ON p.id=t.asignada_a
  WHERE t.id=v_actualizada.id;
  RETURN v_despues;
END $$;

-- RF-UC11-01: entrega al administrador la cronología de ediciones y cambios de estado.
CREATE OR REPLACE FUNCTION public.obtener_historial_tarea(p_tarea_id uuid)
RETURNS TABLE(
  fecha_cambio timestamptz,
  cambiado_por text,
  tipo_cambio text,
  valores_anteriores jsonb,
  valores_nuevos jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca_id uuid;
BEGIN
  SELECT t.finca_id INTO v_finca_id FROM public.tarea_campo t WHERE t.id=p_tarea_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La tarea no existe.' USING ERRCODE='42501'; END IF;
  PERFORM private.validar_acceso_finca(v_finca_id,true,false);

  RETURN QUERY
  SELECT h.fecha_cambio,coalesce(p.nombre_completo,p.correo,'Usuario')::text,'EDICION'::text,
    h.valores_anteriores,h.valores_nuevos
  FROM private.historial_tarea_edicion h
  LEFT JOIN public.perfil_usuario p ON p.id=h.cambiado_por
  WHERE h.tarea_id=p_tarea_id
  UNION ALL
  SELECT h.fecha_cambio,coalesce(p.nombre_completo,p.correo,'Usuario')::text,'ESTADO'::text,
    jsonb_build_object('estado',h.estado_anterior),jsonb_build_object('estado',h.estado_nuevo)
  FROM public.historial_tarea h
  LEFT JOIN public.perfil_usuario p ON p.id=h.cambiado_por
  WHERE h.tarea_id=p_tarea_id
  ORDER BY 1 DESC;
END $$;

REVOKE ALL ON FUNCTION public.actualizar_tarea_finca(uuid,text,text,date,uuid),
  public.obtener_historial_tarea(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_tarea_finca(uuid,text,text,date,uuid),
  public.obtener_historial_tarea(uuid) TO authenticated;

COMMIT;
