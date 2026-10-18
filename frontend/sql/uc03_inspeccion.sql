-- RF-UC03-02: solo lectura, un resultado para comprobar Supabase antes de la migración.
SELECT jsonb_build_object(
  'columnas',(SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('bovino','movimiento_bovino') ORDER BY table_name,ordinal_position) c),
  'restricciones',(SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT conrelid::regclass::text AS tabla,conname,pg_get_constraintdef(oid) AS definicion
    FROM pg_constraint WHERE conrelid IN ('public.bovino'::regclass,'public.movimiento_bovino'::regclass)) c),
  'triggers',(SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT tgname,pg_get_triggerdef(oid) AS definicion FROM pg_trigger
    WHERE tgrelid IN ('public.bovino'::regclass,'public.movimiento_bovino'::regclass) AND NOT tgisinternal) t),
  'funcion_estado',pg_get_functiondef('private.validar_edicion_bovino()'::regprocedure),
  'permisos_tabla',(SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name IN ('bovino','movimiento_bovino')) p),
  'permisos_columna',(SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT table_name,column_name,grantee,privilege_type FROM information_schema.role_column_grants
    WHERE table_schema='public' AND table_name IN ('bovino','movimiento_bovino') AND grantee IN ('anon','authenticated')) p),
  'movimientos_por_tipo',(SELECT jsonb_object_agg(tipo,total) FROM (SELECT tipo,count(*) AS total FROM public.movimiento_bovino GROUP BY tipo) m),
  'toros_sin_asignacion',(SELECT count(*) FROM public.bovino b WHERE NOT EXISTS(
    SELECT 1 FROM public.movimiento_bovino m WHERE m.bovino_id=b.id AND m.tipo='ASIGNACION')),
  'estados',(SELECT jsonb_object_agg(estado,total) FROM (SELECT estado,count(*) AS total FROM public.bovino GROUP BY estado) s)
) AS inspeccion;
