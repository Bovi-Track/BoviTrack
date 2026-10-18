-- RF-UC13-01: comprobaciones de solo lectura, después de aplicar uc13_registrar_baja.sql.
WITH checks AS (
  SELECT 'RPC de baja disponibles' AS comprobacion,
    to_regprocedure('public.registrar_baja(uuid,date,text,numeric)') IS NOT NULL
    AND to_regprocedure('public.completar_perdida_baja(uuid,numeric)') IS NOT NULL
    AND to_regprocedure('public.obtener_bajas_bovino(uuid)') IS NOT NULL
    AND to_regprocedure('public.obtener_perdida_baja(uuid)') IS NOT NULL AS correcto
  UNION ALL
  SELECT 'RPC accesibles solo autenticado',bool_and(
    has_function_privilege('authenticated',firma,'EXECUTE')
    AND NOT has_function_privilege('anon',firma,'EXECUTE'))
    FROM unnest(ARRAY['public.registrar_baja(uuid,date,text,numeric)',
      'public.completar_perdida_baja(uuid,numeric)','public.obtener_bajas_bovino(uuid)',
      'public.obtener_perdida_baja(uuid)']) firma
  UNION ALL
  SELECT 'Helper financiero no invocable directamente',
    NOT has_function_privilege('authenticated','private.calcular_perdida_baja(uuid,numeric)','EXECUTE')
    AND NOT has_function_privilege('anon','private.calcular_perdida_baja(uuid,numeric)','EXECUTE')
  UNION ALL
  SELECT 'Historial y costos sin permisos directos de tabla o columna',bool_and(
    NOT has_table_privilege(rol,'public.registro_mortalidad','SELECT,INSERT,UPDATE,DELETE')
    AND NOT has_any_column_privilege(rol,'public.registro_mortalidad','SELECT,INSERT,UPDATE,REFERENCES'))
    FROM unnest(ARRAY['anon','authenticated']) rol
  UNION ALL
  SELECT 'RLS de bajas habilitado',relrowsecurity FROM pg_class WHERE oid='public.registro_mortalidad'::regclass
  UNION ALL
  SELECT 'Pérdida pendiente permitida',EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='registro_mortalidad'
      AND column_name='perdida_economica' AND is_nullable='YES')
  UNION ALL
  SELECT 'Snapshots económicos presentes',count(*)=6 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='registro_mortalidad'
      AND column_name IN ('perdida_economica','costo_compra_calculado','mantenimiento_diario',
        'mantenimiento_acumulado','calculado_por','calculado_en')
  UNION ALL
  SELECT 'Solo BAJA para mortalidad',NOT EXISTS(SELECT 1 FROM public.bovino WHERE estado='MUERTO')
    AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.bovino'::regclass
      AND conname='bovino_estado_check' AND pg_get_constraintdef(oid) NOT LIKE '%MUERTO%')
  UNION ALL
  SELECT 'Sin venta y baja sobre el mismo toro',NOT EXISTS(
    SELECT 1 FROM public.registro_mortalidad m JOIN public.registro_venta v USING(bovino_id))
  UNION ALL
  SELECT 'Evento y estado consistentes',NOT EXISTS(
    SELECT 1 FROM public.registro_mortalidad m JOIN public.bovino b ON b.id=m.bovino_id WHERE b.estado IS DISTINCT FROM 'BAJA')
    AND NOT EXISTS(SELECT 1 FROM public.bovino b WHERE b.estado='BAJA'
      AND NOT EXISTS(SELECT 1 FROM public.registro_mortalidad m WHERE m.bovino_id=b.id))
  UNION ALL
  SELECT 'Trigger de estados activo',EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.bovino'::regclass AND tgname='validar_edicion_bovino' AND tgenabled='O' AND NOT tgisinternal)
)
SELECT comprobacion,correcto FROM checks ORDER BY comprobacion;
