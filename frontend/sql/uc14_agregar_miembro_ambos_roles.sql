-- RF-UC14-03 y RF-UC15-02 (parcial): paridad de roles en el alta directa por correo.
-- Aplicar como propietario DESPUÉS de uc14_control_acceso.sql. Repetible.
-- Mantiene la invitación por enlace y no crea cuentas ni envía correos.
BEGIN;

CREATE OR REPLACE FUNCTION public.agregar_miembro_finca(
  p_finca_id uuid, p_correo character varying, p_rol_id uuid
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_usuario_id uuid;
  v_rol text;
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id,true,true);

  SELECT r.nombre INTO v_rol FROM public.roles r
    WHERE r.id=p_rol_id AND r.nombre IN ('ADMINISTRADOR','PERSONAL_CAMPO');
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Selecciona un rol válido: ADMINISTRADOR o PERSONAL_CAMPO.' USING ERRCODE='42501';
  END IF;

  SELECT p.id INTO v_usuario_id FROM public.perfil_usuario p
    WHERE lower(p.correo)=lower(btrim(p_correo)) AND p.activo;
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró una cuenta activa con ese correo.';
  END IF;
  -- Conserva la restricción existente que impide retirarse el acceso administrativo.
  IF v_usuario_id=auth.uid() AND v_rol<>'ADMINISTRADOR' THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol de administrador.' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.usuario_finca(usuario_id,finca_id,rol_id)
    VALUES(v_usuario_id,p_finca_id,p_rol_id)
    ON CONFLICT(usuario_id,finca_id) DO UPDATE SET rol_id=EXCLUDED.rol_id;

  RETURN json_build_object('success',true,'usuario_id',v_usuario_id);
END $$;

REVOKE ALL ON FUNCTION public.agregar_miembro_finca(uuid,character varying,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agregar_miembro_finca(uuid,character varying,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
