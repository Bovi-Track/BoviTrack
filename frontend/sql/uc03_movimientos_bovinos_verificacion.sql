-- RF-UC03-02: verificación de solo lectura después de uc03_movimientos_bovinos.sql.
WITH checks AS (
  SELECT 'RPC de movimientos disponibles' AS comprobacion,
    to_regprocedure('public.registrar_movimiento_bovino(uuid,uuid,text,uuid,date,text,uuid)') IS NOT NULL
    AND to_regprocedure('public.obtener_movimientos_bovinos(uuid,uuid,integer,integer)') IS NOT NULL AS correcto
  UNION ALL
  SELECT 'RPC solo autenticado',bool_and(has_function_privilege('authenticated',firma,'EXECUTE')
    AND NOT has_function_privilege('anon',firma,'EXECUTE'))
    FROM unnest(ARRAY['public.registrar_movimiento_bovino(uuid,uuid,text,uuid,date,text,uuid)',
      'public.obtener_movimientos_bovinos(uuid,uuid,integer,integer)']) firma
  UNION ALL
  SELECT 'Helpers privados no invocables',bool_and(NOT has_function_privilege(rol,'private.registrar_asignacion_inicial()','EXECUTE')
    AND NOT has_function_privilege(rol,'private.validar_edicion_bovino()','EXECUTE'))
    FROM unnest(ARRAY['anon','authenticated']) rol
  UNION ALL
  SELECT 'Estado y finca protegidos de cambios directos',bool_and(
    NOT has_column_privilege(rol,'public.bovino','estado','UPDATE')
    AND NOT has_column_privilege(rol,'public.bovino','finca_id','UPDATE'))
    FROM unnest(ARRAY['anon','authenticated']) rol
  UNION ALL
  SELECT 'Edición de datos básicos conservada',has_column_privilege('authenticated','public.bovino','nombre','UPDATE')
    AND has_column_privilege('authenticated','public.bovino','identificador_interno','UPDATE')
  UNION ALL
  SELECT 'Movimientos sin accesos directos',bool_and(
    NOT has_table_privilege(rol,'public.movimiento_bovino','SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_any_column_privilege(rol,'public.movimiento_bovino','SELECT,INSERT,UPDATE,REFERENCES'))
    FROM unnest(ARRAY['anon','authenticated']) rol
  UNION ALL
  SELECT 'RLS de movimientos habilitado',relrowsecurity FROM pg_class WHERE oid='public.movimiento_bovino'::regclass
  UNION ALL
  SELECT 'Asignación inicial diferida activa',EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.bovino'::regclass AND tgname='registrar_asignacion_inicial' AND tgenabled='O'
      AND tgdeferrable AND tginitdeferred AND NOT tgisinternal)
  UNION ALL
  SELECT 'Protección de pertenencia y estado activa',EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.bovino'::regclass AND tgname='validar_edicion_bovino' AND tgenabled='O' AND NOT tgisinternal)
  UNION ALL
  SELECT 'Movimientos con origen y destino consistentes',NOT EXISTS(SELECT 1 FROM public.movimiento_bovino
    WHERE (tipo='ASIGNACION' AND (finca_origen_id IS NOT NULL OR finca_destino_id IS NULL))
      OR (tipo='RETIRO' AND (finca_origen_id IS NULL OR finca_destino_id IS NOT NULL))
      OR (tipo='TRASLADO' AND (finca_origen_id IS NULL OR finca_destino_id IS NULL OR finca_origen_id=finca_destino_id)))
)
SELECT comprobacion,correcto FROM checks ORDER BY comprobacion;
