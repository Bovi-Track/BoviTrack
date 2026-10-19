-- RF-UC13-01: solo lectura. Un único resultado para el SQL Editor de Supabase.
SELECT jsonb_build_object(
  'columnas', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public'
      AND table_name IN ('bovino','registro_mortalidad','registro_venta','pesaje')
    ORDER BY table_name,ordinal_position) c),
  'restricciones', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT conrelid::regclass::text AS tabla,conname,pg_get_constraintdef(oid) AS definicion
    FROM pg_constraint WHERE conrelid IN ('public.bovino'::regclass,'public.registro_mortalidad'::regclass,'public.registro_venta'::regclass)) c),
  'trigger', pg_get_functiondef('private.validar_edicion_bovino()'::regprocedure),
  'estados', (SELECT jsonb_object_agg(estado,total) FROM (SELECT estado,count(*) AS total FROM public.bovino GROUP BY estado) s),
  'muertos_sin_evento', (SELECT count(*) FROM public.bovino b WHERE estado='MUERTO'
    AND NOT EXISTS(SELECT 1 FROM public.registro_mortalidad m WHERE m.bovino_id=b.id)),
  'eventos_incompatibles', (SELECT count(*) FROM public.registro_mortalidad m JOIN public.registro_venta v USING(bovino_id)),
  'permisos', (SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT grantee,privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='registro_mortalidad') p)
) AS inspeccion;
