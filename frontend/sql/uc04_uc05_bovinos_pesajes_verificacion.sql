-- RF-UC04-01 y RF-UC05-01: comprobaciones de solo lectura, después de aplicar el SQL.
WITH checks AS (
  SELECT 'RPC obtener_bovinos_finca' AS comprobacion,
    to_regprocedure('public.obtener_bovinos_finca(uuid)') IS NOT NULL AS correcto
  UNION ALL
  SELECT 'RPC registrar_bovinos',
    to_regprocedure('public.registrar_bovinos(jsonb)') IS NOT NULL
  UNION ALL
  SELECT 'RPC actualizar_bovino',
    to_regprocedure('public.actualizar_bovino(uuid,text,text,text,text)') IS NOT NULL
  UNION ALL
  SELECT 'RPC obtener_pesajes_finca',
    to_regprocedure('public.obtener_pesajes_finca(uuid)') IS NOT NULL
  UNION ALL
  SELECT 'RPC registrar_pesaje',
    to_regprocedure('public.registrar_pesaje(uuid,numeric,date,uuid)') IS NOT NULL
  UNION ALL
  SELECT 'EXECUTE autenticado / anónimo denegado',
    has_function_privilege('authenticated','public.registrar_bovinos(jsonb)','EXECUTE')
    AND has_function_privilege('authenticated','public.registrar_pesaje(uuid,numeric,date,uuid)','EXECUTE')
    AND has_function_privilege('authenticated','public.obtener_bovinos_finca(uuid)','EXECUTE')
    AND has_function_privilege('authenticated','public.obtener_pesajes_finca(uuid)','EXECUTE')
    AND NOT has_function_privilege('anon','public.registrar_bovinos(jsonb)','EXECUTE')
    AND NOT has_function_privilege('anon','public.registrar_pesaje(uuid,numeric,date,uuid)','EXECUTE')
  UNION ALL
  SELECT 'Sin acceso directo a bovino, pesaje ni sanidad',
    NOT has_table_privilege('authenticated','public.bovino','SELECT')
    AND NOT has_table_privilege('authenticated','public.bovino','INSERT')
    AND NOT has_table_privilege('authenticated','public.bovino','UPDATE')
    AND NOT has_table_privilege('authenticated','public.pesaje','SELECT')
    AND NOT has_table_privilege('authenticated','public.pesaje','INSERT')
    AND NOT has_table_privilege('authenticated','public.registro_sanitario','SELECT')
    AND NOT has_table_privilege('authenticated','public.registro_sanitario','INSERT')
    AND NOT has_table_privilege('anon','public.bovino','SELECT')
    AND NOT has_table_privilege('anon','public.pesaje','SELECT')
    AND NOT has_table_privilege('anon','public.registro_sanitario','SELECT')
  UNION ALL
  SELECT 'Sin políticas de acceso directo a bovino, pesaje ni sanidad',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename IN ('bovino','pesaje','registro_sanitario')
        AND policyname IN (
          'acceso_bovino_alta','acceso_bovino_edicion','acceso_bovino_consulta',
          'acceso_pesaje_consulta','acceso_sanidad_consulta'
        )
    )
)
SELECT comprobacion, correcto FROM checks ORDER BY comprobacion;
