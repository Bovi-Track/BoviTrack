-- Ejecutar después de uc02_trazabilidad_bovino.sql en el SQL Editor de Supabase.
-- Devuelve una sola fila para comprobar firma, acceso, cobertura y campos de salida.
WITH fn AS (
  SELECT p.oid, p.prosrc, p.proargnames,
    pg_get_function_result(p.oid) AS resultado,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'obtener_trazabilidad_bovino'
    AND pg_get_function_identity_arguments(p.oid) = 'p_bovino_id uuid'
)
SELECT jsonb_build_object(
  'RPC disponible', EXISTS(SELECT 1 FROM fn),
  'RPC solo autenticado', coalesce((SELECT auth_exec AND NOT anon_exec FROM fn), false),
  'Firma sin columnas financieras', coalesce((SELECT resultado =
    'TABLE(evento_id uuid, tipo_evento text, fecha_evento date, registrado_en timestamp with time zone, titulo text, detalle text, responsable text)'
    FROM fn), false),
  'Valida acceso vigente a finca', coalesce((SELECT position('validar_acceso_finca' in prosrc) > 0 FROM fn), false),
  'Incluye compra, movimientos, pesajes, sanidad, venta y baja', coalesce((SELECT
    position('compra_subasta' in prosrc) > 0 AND
    position('movimiento_bovino' in prosrc) > 0 AND
    position('public.pesaje' in prosrc) > 0 AND
    position('registro_sanitario' in prosrc) > 0 AND
    position('registro_venta' in prosrc) > 0 AND
    position('registro_mortalidad' in prosrc) > 0
    FROM fn), false),
  'No devuelve importes ni precios', coalesce((SELECT
    position('precio_kilo' in prosrc) = 0 AND
    position('rentabilidad_calculada' in prosrc) = 0 AND
    position('perdida_economica' in prosrc) = 0 AND
    position('costo_flete_total' in prosrc) = 0 AND
    position('costo_compra_calculado' in prosrc) = 0 AND
    position('mantenimiento_acumulado' in prosrc) = 0
    FROM fn), false),
  'Orden cronológico determinista', coalesce((SELECT
    position('ORDER BY e.fecha_evento ASC' in prosrc) > 0 AND
    position('e.registrado_en ASC' in prosrc) > 0
    FROM fn), false)
) AS comprobacion;
