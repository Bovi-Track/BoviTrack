-- Verificación de despliegue, solo lectura. Ejecutar en Supabase SQL Editor.
-- Devuelve objetos, propietarios y permisos; no modifica datos ni grants.
BEGIN TRANSACTION READ ONLY;
WITH firmas(firma, publica) AS (VALUES
  ('public.obtener_inventario_finca(uuid)', true),
  ('public.obtener_movimientos_insumo(uuid,integer,integer)', true),
  ('public.guardar_insumo(uuid,text,text,text,uuid)', true),
  ('public.desactivar_insumo(uuid)', true),
  ('public.registrar_movimiento_inventario(uuid,text,numeric,date,text)', true),
  ('public.obtener_reporte_inventario(uuid,date,date)', true),
  ('private.validar_acceso_inventario(uuid,boolean,boolean)', false)
), funciones AS (
  SELECT f.firma, f.publica, p.oid IS NOT NULL AS existe,
    pg_catalog.pg_get_userbyid(p.proowner) AS propietario,
    p.prosecdef AS security_definer, p.provolatile AS volatilidad,
    p.proconfig AS configuracion,
    pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
    pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
    EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_execute
  FROM firmas f LEFT JOIN pg_catalog.pg_proc p ON p.oid = pg_catalog.to_regprocedure(f.firma)
), tablas AS (
  SELECT c.relname AS tabla, c.relrowsecurity AS rls,
    pg_catalog.pg_get_userbyid(c.relowner) AS propietario,
    pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_acceso_directo,
    pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS authenticated_acceso_directo,
    pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES') AS anon_acceso_columnas,
    pg_catalog.has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES') AS authenticated_acceso_columnas
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('insumo', 'movimiento_inventario')
), indices AS (
  SELECT c.relname AS indice, x.indisvalid AS valido, pg_catalog.pg_get_indexdef(c.oid) AS definicion
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_index x ON x.indexrelid = c.oid
  WHERE n.nspname = 'public' AND c.relname IN ('insumo_finca_idx', 'movimiento_inventario_insumo_fecha_idx')
)
SELECT pg_catalog.jsonb_build_object(
  'funciones', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) ORDER BY firma) FROM funciones f),
  'tablas', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY tabla) FROM tablas t),
  'indices', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY indice) FROM indices i)
) AS verificacion_inventario;
COMMIT;
-- Esperado: siete funciones existentes, SECURITY DEFINER y search_path vacío;
-- solo las seis públicas con authenticated_execute=true. anon_execute y
-- public_execute=false en todas. Dos tablas con RLS y todos los accesos directos
-- (incluidos columnas/TRUNCATE) false. Dos índices válidos con definición correcta.
-- Revisar que los propietarios de las funciones tengan acceso autorizado a tablas.
