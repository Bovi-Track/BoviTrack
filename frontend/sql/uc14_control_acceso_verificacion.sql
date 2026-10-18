-- RF-UC14-01/03. Solo lectura, para el propietario en Supabase SQL Editor.
-- Ejecutar ANTES de uc14_control_acceso.sql y contrastar con la estructura local.
-- Repetir DESPUÉS: deben quedar dos roles, RPC con search_path seguro y grants
-- mínimos. No exportar tokens, contraseñas ni datos de usuarios.
SELECT r.id,r.nombre,
  (SELECT count(*) FROM public.usuario_finca uf WHERE uf.rol_id=r.id) AS membresias,
  (SELECT count(*) FROM public.invitacion_finca i WHERE i.rol_id=r.id) AS invitaciones
FROM public.roles r ORDER BY r.nombre;

-- Detecta dependencias adicionales antes de consolidar IDs de roles.
SELECT c.conrelid::regclass AS tabla,c.conname,pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint c WHERE c.confrelid='public.roles'::regclass;

SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS argumentos,
  pg_get_userbyid(p.proowner) AS propietario,p.prosecdef AS security_definer,p.proconfig,
  pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.proname IN (
  'cuenta_activa','rol_finca','validar_acceso_finca','verificar_cuenta_activa','autorizar_reporte_finca',
  'obtener_costos_bovinos_finca','es_miembro_finca','obtener_fincas_usuario','crear_finca','actualizar_finca',
  'obtener_roles','obtener_miembros_finca','agregar_miembro_finca','eliminar_miembro_finca','crear_invitacion_finca',
  'aceptar_invitacion_finca','crear_tarea_finca','obtener_tareas_finca','marcar_tarea_estado',
  'obtener_registros_sanitarios_finca','registrar_aplicacion_sanitaria','eliminar_registro_sanitario',
  'validar_acceso_inventario','obtener_inventario_finca','obtener_movimientos_insumo','guardar_insumo',
  'desactivar_insumo','registrar_movimiento_inventario','obtener_reporte_inventario','registrar_compra_subasta','registrar_compra_subasta_impl','procesar_operacion_offline')
ORDER BY n.nspname,p.proname,argumentos;

SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind='r' ORDER BY n.nspname,c.relname;
SELECT * FROM pg_policies WHERE schemaname IN ('public','private') ORDER BY schemaname,tablename,policyname;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges
WHERE table_schema IN ('public','private') AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_schema,table_name,grantee,privilege_type;
SELECT table_schema,table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema IN ('public','private') AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_schema,table_name,column_name,grantee,privilege_type;
SELECT routine_schema,routine_name,grantee,privilege_type FROM information_schema.routine_privileges
WHERE routine_schema IN ('public','private') AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY routine_schema,routine_name,grantee;
SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal;

-- Resumen único final: el editor puede mostrar solo el último resultado del archivo.
-- Antes de migrar mostrará diferencias; después, todas las filas deben ser correcto=true.
WITH esperadas(firma,permite_authenticated,permite_anon) AS (VALUES
  ('public.verificar_cuenta_activa()',true,false),
  ('public.autorizar_reporte_finca(uuid)',true,false),
  ('public.obtener_costos_bovinos_finca(uuid)',true,false),
  ('public.es_miembro_finca(uuid)',true,false),
  ('public.obtener_fincas_usuario(uuid)',true,false),
  ('public.crear_finca(text,text)',true,false),
  ('public.actualizar_finca(uuid,character varying,text,boolean)',true,false),
  ('public.obtener_roles()',true,false),
  ('public.obtener_miembros_finca(uuid)',true,false),
  ('public.agregar_miembro_finca(uuid,character varying,uuid)',true,false),
  ('public.eliminar_miembro_finca(uuid,uuid)',true,false),
  ('public.crear_invitacion_finca(uuid,uuid)',true,false),
  ('public.aceptar_invitacion_finca(text)',true,false),
  ('public.crear_tarea_finca(uuid,text,text,date,uuid)',true,false),
  ('public.obtener_tareas_finca(uuid)',true,false),
  ('public.marcar_tarea_estado(uuid,text)',true,false),
  ('public.obtener_registros_sanitarios_finca(uuid)',true,false),
  ('public.registrar_aplicacion_sanitaria(uuid,text,text,text,date,date,text,text)',true,false),
  ('public.registrar_compra_subasta(text,text,date,numeric,text,jsonb)',true,false),
  ('public.procesar_operacion_offline(uuid,uuid,text,jsonb)',true,false),
  ('public.obtener_inventario_finca(uuid)',true,false),
  ('public.obtener_movimientos_insumo(uuid,integer,integer)',true,false),
  ('public.guardar_insumo(uuid,text,text,text,uuid)',true,false),
  ('public.desactivar_insumo(uuid)',true,false),
  ('public.registrar_movimiento_inventario(uuid,text,numeric,date,text)',true,false),
  ('public.obtener_reporte_inventario(uuid,date,date)',true,false),
  ('public.eliminar_registro_sanitario(uuid)',false,false),
  ('public.handle_new_user()',false,false),
  ('public.correo_por_username(text)',true,true),
  ('private.registrar_compra_subasta_impl(text,text,date,numeric,text,jsonb)',true,false)
), funciones AS (
  SELECT e.*,to_regprocedure(e.firma)::oid AS oid FROM esperadas e
), tablas(nombre) AS (VALUES
  ('roles'),('perfil_usuario'),('usuario_finca'),('invitacion_finca'),('finca'),('bovino'),
  ('pesaje'),('registro_sanitario'),('tarea_campo'),('historial_tarea'),('compra_subasta'),
  ('movimiento_bovino'),('registro_venta'),('registro_mortalidad'),('insumo'),('movimiento_inventario')
), resumen AS (
  SELECT 'roles'::text AS comprobacion,string_agg(r.nombre,', ' ORDER BY r.nombre)::text AS detalle,
    count(*)=2 AND bool_and(r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO')) AS correcto FROM public.roles r
  UNION ALL
  SELECT 'RLS', '16 tablas públicas protegidas',count(*)=16 AND bool_and(c.relrowsecurity)
    FROM tablas t JOIN pg_namespace n ON n.nspname='public' JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=t.nombre
  UNION ALL
  SELECT 'costos directos', 'precio_compra_kilo y costo_flete_asignado denegados a clientes',NOT EXISTS(
    SELECT 1 FROM (VALUES ('anon'),('authenticated')) AS r(nombre)
      CROSS JOIN (VALUES ('precio_compra_kilo'),('costo_flete_asignado'),('compra_id')) AS c(nombre)
    WHERE has_column_privilege(r.nombre,'public.bovino',c.nombre,'SELECT'))
  UNION ALL
  SELECT 'tablas internas','sin grants de tabla/columna para anon ni authenticated',NOT EXISTS(
    SELECT 1 FROM tablas t CROSS JOIN (VALUES ('anon'),('authenticated')) AS r(nombre)
    WHERE t.nombre NOT IN ('bovino','pesaje','registro_sanitario','finca') AND (
      has_table_privilege(r.nombre,format('public.%I',t.nombre),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(r.nombre,format('public.%I',t.nombre),'SELECT,INSERT,UPDATE,REFERENCES')))
  UNION ALL
  SELECT 'trigger bovino','validar_edicion_bovino activo',EXISTS(
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.bovino'::regclass
      AND t.tgname='validar_edicion_bovino' AND t.tgenabled='O' AND NOT t.tgisinternal)
  UNION ALL
  SELECT f.firma,format('authenticated=%s; anon=%s',has_function_privilege('authenticated',f.oid,'EXECUTE'),has_function_privilege('anon',f.oid,'EXECUTE')),
    f.oid IS NOT NULL AND coalesce(has_function_privilege('authenticated',f.oid,'EXECUTE')=f.permite_authenticated,false)
      AND coalesce(has_function_privilege('anon',f.oid,'EXECUTE')=f.permite_anon,false)
      AND NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE p.oid=f.oid AND a.grantee=0 AND a.privilege_type='EXECUTE')
  FROM funciones f
)
SELECT comprobacion,detalle,correcto FROM resumen ORDER BY comprobacion;
