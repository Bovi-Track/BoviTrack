-- Verifica RPC, permisos directos, snapshots económicos y trigger de venta.
WITH checks AS (
  SELECT 'RPC registrar_venta' AS comprobacion,
    to_regprocedure('public.registrar_venta(uuid,date,numeric,numeric,text,numeric)') IS NOT NULL AS correcto
  UNION ALL
  SELECT 'RPC obtener_ventas_finca',
    to_regprocedure('public.obtener_ventas_finca(uuid)') IS NOT NULL
  UNION ALL
  SELECT 'EXECUTE autenticado / anónimo denegado',
    has_function_privilege('authenticated','public.registrar_venta(uuid,date,numeric,numeric,text,numeric)','EXECUTE')
    AND NOT has_function_privilege('anon','public.registrar_venta(uuid,date,numeric,numeric,text,numeric)','EXECUTE')
    AND has_function_privilege('authenticated','public.obtener_ventas_finca(uuid)','EXECUTE')
    AND NOT has_function_privilege('anon','public.obtener_ventas_finca(uuid)','EXECUTE')
  UNION ALL
  SELECT 'Sin acceso directo a registro_venta',
    NOT has_table_privilege('authenticated','public.registro_venta','SELECT')
    AND NOT has_table_privilege('authenticated','public.registro_venta','INSERT')
    AND NOT has_table_privilege('anon','public.registro_venta','SELECT')
    AND NOT has_table_privilege('anon','public.registro_venta','INSERT')
  UNION ALL
  SELECT 'Snapshots económicos y rentabilidad nullable',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='registro_venta' AND column_name='costo_compra_calculado')
    AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='registro_venta' AND column_name='mantenimiento_acumulado')
    AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='registro_venta' AND column_name='rentabilidad_calculada' AND is_nullable='YES')
  UNION ALL
  SELECT 'Trigger de estado de bovino activo',
    EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='bovino'
        AND t.tgname='validar_edicion_bovino' AND t.tgenabled='O' AND NOT t.tgisinternal)
)
SELECT comprobacion,correcto FROM checks ORDER BY comprobacion;
