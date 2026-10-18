-- RF-UC02-01: entrega la cronología operativa completa de un toro autorizado.
-- No incluye importes, precios ni rentabilidad; puede consultarla ADMINISTRADOR y PERSONAL_CAMPO.
-- Aplicar después de uc03_movimientos_bovinos.sql, uc12_registrar_venta.sql,
-- uc13_registrar_baja.sql y uc14_control_acceso.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_trazabilidad_bovino(p_bovino_id uuid)
RETURNS TABLE(
  evento_id uuid,
  tipo_evento text,
  fecha_evento date,
  registrado_en timestamptz,
  titulo text,
  detalle text,
  responsable text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_finca_id uuid;
BEGIN
  IF p_bovino_id IS NULL THEN
    RAISE EXCEPTION 'Indica un toro para consultar su trazabilidad.';
  END IF;

  SELECT b.finca_id INTO v_finca_id
  FROM public.bovino b
  WHERE b.id = p_bovino_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el toro.';
  END IF;

  PERFORM private.validar_acceso_finca(v_finca_id, false);

  RETURN QUERY
  WITH eventos AS (
    SELECT c.id AS evento_id, 'COMPRA'::text AS tipo_evento, c.fecha_compra AS fecha_evento,
      c.created_at AS registrado_en, 'Ingreso por compra'::text AS titulo,
      concat_ws(' · ', CASE WHEN c.id_subasta IS NOT NULL THEN 'Subasta ' || c.id_subasta END,
        CASE WHEN c.proveedor IS NOT NULL THEN 'Proveedor ' || c.proveedor END) AS detalle,
      coalesce(p.nombre_completo, p.correo, 'No disponible')::text AS responsable
    FROM public.bovino b
    JOIN public.compra_subasta c ON c.id = b.compra_id
    LEFT JOIN public.perfil_usuario p ON p.id = c.id_usuario
    WHERE b.id = p_bovino_id

    UNION ALL

    SELECT m.id, 'MOVIMIENTO'::text, m.fecha_movimiento, m.created_at,
      CASE m.tipo WHEN 'ASIGNACION' THEN 'Asignación'
        WHEN 'RETIRO' THEN 'Retiro' ELSE 'Traslado' END::text,
      concat_ws(' · ',
        CASE WHEN m.finca_origen_id IS NOT NULL THEN 'Origen: ' || fo.nombre END,
        CASE WHEN m.finca_destino_id IS NOT NULL THEN 'Destino: ' || fd.nombre END,
        nullif(btrim(m.observaciones), ''))::text,
      coalesce(p.nombre_completo, p.correo, 'No disponible')::text
    FROM public.movimiento_bovino m
    LEFT JOIN public.finca fo ON fo.id = m.finca_origen_id
    LEFT JOIN public.finca fd ON fd.id = m.finca_destino_id
    LEFT JOIN public.perfil_usuario p ON p.id = m.registrado_por
    WHERE m.bovino_id = p_bovino_id

    UNION ALL

    SELECT w.id, 'PESAJE'::text, w.fecha_pesaje, w.created_at,
      CASE WHEN w.es_inicial THEN 'Pesaje inicial' ELSE 'Pesaje' END::text,
      concat_ws(' · ', 'Peso: ' || w.peso_kg::text || ' kg', nullif(btrim(w.observaciones), ''))::text,
      coalesce(p.nombre_completo, p.correo, 'No disponible')::text
    FROM public.pesaje w
    LEFT JOIN public.perfil_usuario p ON p.id = w.registrado_por
    WHERE w.bovino_id = p_bovino_id

    UNION ALL

    SELECT s.id, 'SANIDAD'::text, s.fecha_aplicacion, s.created_at,
      CASE
        WHEN s.observaciones ~ '^\[SANIDAD:([A-Z]+)\]' THEN
          CASE substring(s.observaciones from '^\[SANIDAD:([A-Z]+)\]')
            WHEN 'VACUNACION' THEN 'Vacunación'
            WHEN 'DESPARASITACION' THEN 'Desparasitación'
            WHEN 'VITAMINIZACION' THEN 'Vitaminización'
            WHEN 'TRATAMIENTO' THEN 'Tratamiento'
            ELSE 'Aplicación sanitaria'
          END
        WHEN i.tipo = 'VACUNA' THEN 'Vacunación'
        ELSE 'Tratamiento'
      END::text,
      concat_ws(' · ', coalesce(i.nombre, 'Sin insumo'),
        s.dosis_aplicada::text || ' ' || coalesce(i.unidad_medida, 'ml'),
        CASE WHEN s.proxima_aplicacion IS NOT NULL THEN 'Próxima: ' || s.proxima_aplicacion::text END,
        nullif(btrim(regexp_replace(coalesce(s.observaciones, ''), '^\[SANIDAD:[A-Z]+\]\s*', '')), ''))::text,
      coalesce(p.nombre_completo, p.correo, 'No disponible')::text
    FROM public.registro_sanitario s
    LEFT JOIN public.insumo i ON i.id = s.insumo_id
    LEFT JOIN public.perfil_usuario p ON p.id = s.aplicado_por
    WHERE s.bovino_id = p_bovino_id

    UNION ALL

    SELECT v.id, 'VENTA'::text, v.fecha_venta, v.created_at,
      'Venta registrada'::text,
      'Peso de salida: ' || v.peso_salida_kg::text || ' kg' AS detalle,
      coalesce(p.nombre_completo, p.correo, 'No disponible')::text
    FROM public.registro_venta v
    LEFT JOIN public.perfil_usuario p ON p.id = v.registrado_por
    WHERE v.bovino_id = p_bovino_id

    UNION ALL

    SELECT d.id, 'BAJA'::text, d.fecha_baja, d.created_at,
      'Baja registrada'::text, d.causa_medica::text,
      coalesce(p.nombre_completo, p.correo, 'No disponible')::text
    FROM public.registro_mortalidad d
    LEFT JOIN public.perfil_usuario p ON p.id = d.registrado_por
    WHERE d.bovino_id = p_bovino_id
  )
  SELECT e.evento_id, e.tipo_evento, e.fecha_evento, e.registrado_en,
    e.titulo, nullif(e.detalle, ''), e.responsable
  FROM eventos e
  ORDER BY e.fecha_evento ASC, e.registrado_en ASC NULLS FIRST, e.tipo_evento ASC, e.evento_id ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.obtener_trazabilidad_bovino(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_trazabilidad_bovino(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
