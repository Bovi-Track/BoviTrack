-- RF-UC03-02: ejecutar después de uc13_registrar_baja.sql, como propietario.
-- Comprobar primero uc03_inspeccion.sql. Repetible y transaccional.
-- RETIRO conserva la última finca y pasa a INACTIVO; ASIGNACION reingresa el toro.
BEGIN;
LOCK TABLE public.bovino,public.movimiento_bovino IN SHARE ROW EXCLUSIVE MODE;
CREATE INDEX IF NOT EXISTS movimiento_bovino_cronologia
  ON public.movimiento_bovino(bovino_id,fecha_movimiento DESC,created_at DESC);

-- Completa el alta general al confirmar la transacción. Compras ya guarda su asignación;
-- el trigger diferido la reconoce sin duplicarla. No reconstruye eventos históricos desconocidos.
CREATE OR REPLACE FUNCTION private.registrar_asignacion_inicial() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.bovino WHERE id=NEW.id)
    AND NOT EXISTS(SELECT 1 FROM public.movimiento_bovino WHERE bovino_id=NEW.id AND tipo='ASIGNACION') THEN
    INSERT INTO public.movimiento_bovino(bovino_id,finca_origen_id,finca_destino_id,registrado_por,tipo,fecha_movimiento,created_at)
      VALUES(NEW.id,NULL,NEW.finca_id,auth.uid(),'ASIGNACION',NEW.fecha_ingreso,coalesce(NEW.created_at,now()));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS registrar_asignacion_inicial ON public.bovino;
CREATE CONSTRAINT TRIGGER registrar_asignacion_inicial AFTER INSERT ON public.bovino
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.registrar_asignacion_inicial();

-- Cada cambio de pertenencia/estado necesita su evento insertado en esta misma transacción.
-- Los datos básicos siguen editables y VENDIDO/BAJA permanecen terminales.
CREATE OR REPLACE FUNCTION private.validar_edicion_bovino() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tipo text;
BEGIN
  IF NEW.finca_id IS NOT DISTINCT FROM OLD.finca_id AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado IN ('VENDIDO','BAJA') THEN
    RAISE EXCEPTION 'Un toro vendido o dado de baja no puede cambiar de finca ni de estado.';
  END IF;
  IF OLD.estado='ACTIVO' AND NEW.estado='VENDIDO' AND NEW.finca_id=OLD.finca_id
    AND EXISTS(SELECT 1 FROM public.registro_venta WHERE bovino_id=OLD.id AND xmin=pg_current_xact_id()::xid)
    AND NOT EXISTS(SELECT 1 FROM public.registro_mortalidad WHERE bovino_id=OLD.id) THEN RETURN NEW; END IF;
  IF OLD.estado='ACTIVO' AND NEW.estado='BAJA' AND NEW.finca_id=OLD.finca_id
    AND EXISTS(SELECT 1 FROM public.registro_mortalidad WHERE bovino_id=OLD.id AND xmin=pg_current_xact_id()::xid)
    AND NOT EXISTS(SELECT 1 FROM public.registro_venta WHERE bovino_id=OLD.id) THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.registro_venta WHERE bovino_id=OLD.id)
    OR EXISTS(SELECT 1 FROM public.registro_mortalidad WHERE bovino_id=OLD.id) THEN
    RAISE EXCEPTION 'El toro ya tiene una venta o baja registrada.';
  END IF;
  IF OLD.estado='ACTIVO' AND NEW.estado='ACTIVO' AND NEW.finca_id IS DISTINCT FROM OLD.finca_id THEN v_tipo := 'TRASLADO';
  ELSIF OLD.estado='ACTIVO' AND NEW.estado='INACTIVO' AND NEW.finca_id=OLD.finca_id THEN v_tipo := 'RETIRO';
  ELSIF OLD.estado='INACTIVO' AND NEW.estado='ACTIVO' THEN v_tipo := 'ASIGNACION';
  ELSE RAISE EXCEPTION 'Usa el flujo de movimientos, venta o baja para cambiar la pertenencia o el estado.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.movimiento_bovino m WHERE m.bovino_id=OLD.id
    AND m.tipo=v_tipo AND m.xmin=pg_current_xact_id()::xid
    AND ((v_tipo='ASIGNACION' AND m.finca_origen_id IS NULL) OR m.finca_origen_id=OLD.finca_id)
    AND ((v_tipo='RETIRO' AND m.finca_destino_id IS NULL) OR m.finca_destino_id=NEW.finca_id)) THEN
    RAISE EXCEPTION 'El cambio requiere registrar su movimiento en la misma transacción.';
  END IF;
  RETURN NEW;
END $$;

-- RF-UC03-02: autoriza, bloquea el toro y confirma pertenencia e historial atómicamente.
CREATE OR REPLACE FUNCTION public.registrar_movimiento_bovino(
  p_bovino_id uuid,p_finca_origen_id uuid,p_tipo text,p_finca_destino_id uuid,p_fecha date,
  p_observaciones text DEFAULT NULL,p_operacion_id uuid DEFAULT gen_random_uuid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_bovino public.bovino%ROWTYPE;
  v_usuario uuid;
  v_destino uuid;
  v_estado text;
  v_ultima date;
  v_anterior public.movimiento_bovino%ROWTYPE;
BEGIN
  IF p_operacion_id IS NULL OR p_tipo IS NULL OR p_tipo NOT IN ('ASIGNACION','RETIRO','TRASLADO') THEN
    RAISE EXCEPTION 'Indica un movimiento válido.';
  END IF;
  SELECT * INTO v_bovino FROM public.bovino WHERE id=p_bovino_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el toro.'; END IF;
  -- Bloquea fincas en orden estable para no cruzar un traslado con su desactivación.
  PERFORM id FROM public.finca WHERE id IN (p_finca_origen_id,p_finca_destino_id) ORDER BY id FOR SHARE;
  v_usuario := private.validar_acceso_finca(p_finca_origen_id,true,true);
  IF p_tipo='RETIRO' THEN
    IF p_finca_destino_id IS NOT NULL THEN RAISE EXCEPTION 'El retiro no tiene finca de destino.'; END IF;
    v_destino := p_finca_origen_id; v_estado := 'INACTIVO';
  ELSE
    PERFORM private.validar_acceso_finca(p_finca_destino_id,true,true);
    v_destino := p_finca_destino_id; v_estado := 'ACTIVO';
    IF p_tipo='TRASLADO' AND v_destino=p_finca_origen_id THEN RAISE EXCEPTION 'Selecciona una finca de destino distinta.'; END IF;
  END IF;
  -- Una respuesta perdida puede reintentarse con el mismo ID sin repetir el movimiento.
  SELECT * INTO v_anterior FROM public.movimiento_bovino WHERE id=p_operacion_id;
  IF FOUND THEN
    IF v_anterior.bovino_id=p_bovino_id AND v_anterior.registrado_por=v_usuario AND v_anterior.tipo=p_tipo
      AND v_anterior.fecha_movimiento=p_fecha AND v_anterior.finca_destino_id IS NOT DISTINCT FROM p_finca_destino_id
      AND v_anterior.observaciones IS NOT DISTINCT FROM nullif(btrim(p_observaciones),'')
      AND ((p_tipo='ASIGNACION' AND v_anterior.finca_origen_id IS NULL) OR v_anterior.finca_origen_id=p_finca_origen_id) THEN
      RETURN jsonb_build_object('id',v_anterior.id,'bovino_id',p_bovino_id,'finca_id',v_destino,'estado',v_estado);
    END IF;
    RAISE EXCEPTION 'El identificador ya corresponde a otro movimiento.';
  END IF;
  IF v_bovino.finca_id IS DISTINCT FROM p_finca_origen_id THEN RAISE EXCEPTION 'El toro ya no pertenece a la finca de origen. Actualiza el hato.'; END IF;
  IF (p_tipo='ASIGNACION' AND v_bovino.estado IS DISTINCT FROM 'INACTIVO')
    OR (p_tipo IN ('RETIRO','TRASLADO') AND v_bovino.estado IS DISTINCT FROM 'ACTIVO') THEN
    RAISE EXCEPTION 'El movimiento no corresponde al estado actual del toro.';
  END IF;
  IF p_fecha IS NULL OR NOT isfinite(p_fecha) OR p_fecha>CURRENT_DATE OR p_fecha<v_bovino.fecha_ingreso THEN
    RAISE EXCEPTION 'La fecha debe estar entre el ingreso del toro y hoy.';
  END IF;
  SELECT max(fecha_movimiento) INTO v_ultima FROM public.movimiento_bovino WHERE bovino_id=p_bovino_id;
  IF p_fecha<v_ultima THEN RAISE EXCEPTION 'La fecha no puede ser anterior al último movimiento.'; END IF;
  IF char_length(coalesce(p_observaciones,''))>2000 THEN RAISE EXCEPTION 'Las observaciones admiten hasta 2000 caracteres.'; END IF;
  INSERT INTO public.movimiento_bovino(id,bovino_id,finca_origen_id,finca_destino_id,registrado_por,tipo,fecha_movimiento,observaciones)
    VALUES(p_operacion_id,p_bovino_id,CASE WHEN p_tipo='ASIGNACION' THEN NULL ELSE p_finca_origen_id END,
      p_finca_destino_id,v_usuario,p_tipo,p_fecha,nullif(btrim(p_observaciones),''));
  UPDATE public.bovino SET finca_id=v_destino,estado=v_estado WHERE id=p_bovino_id;
  RETURN jsonb_build_object('id',p_operacion_id,'bovino_id',p_bovino_id,'finca_id',v_destino,'estado',v_estado);
END $$;

-- RF-UC03-02: historial operativo paginado. La finca conserva sus movimientos tras la salida;
-- la finca actual puede consultar todos los movimientos del toro, sin datos económicos.
CREATE OR REPLACE FUNCTION public.obtener_movimientos_bovinos(
  p_finca_id uuid,p_bovino_id uuid DEFAULT NULL,p_limite integer DEFAULT 50,p_desde integer DEFAULT 0
) RETURNS TABLE(id uuid,bovino_id uuid,identificador_interno varchar,nombre varchar,tipo varchar,
  finca_origen_id uuid,finca_origen_nombre varchar,finca_destino_id uuid,finca_destino_nombre varchar,
  fecha_movimiento date,observaciones text,registrado_por uuid,responsable varchar,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id);
  IF p_limite IS NULL OR p_limite<1 OR p_limite>100 OR p_desde IS NULL OR p_desde<0 THEN
    RAISE EXCEPTION 'La paginación no es válida.';
  END IF;
  IF p_bovino_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bovino b WHERE b.id=p_bovino_id
    AND (b.finca_id=p_finca_id OR EXISTS(SELECT 1 FROM public.movimiento_bovino m WHERE m.bovino_id=b.id
      AND (m.finca_origen_id=p_finca_id OR m.finca_destino_id=p_finca_id)))) THEN
    RAISE EXCEPTION 'No tienes acceso al historial de movimientos de este toro.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT m.id,m.bovino_id,b.identificador_interno,b.nombre,m.tipo,
    m.finca_origen_id,o.nombre,m.finca_destino_id,d.nombre,m.fecha_movimiento,m.observaciones,
    m.registrado_por,u.nombre_completo,m.created_at
    FROM public.movimiento_bovino m JOIN public.bovino b ON b.id=m.bovino_id
    LEFT JOIN public.finca o ON o.id=m.finca_origen_id LEFT JOIN public.finca d ON d.id=m.finca_destino_id
    LEFT JOIN public.perfil_usuario u ON u.id=m.registrado_por
    WHERE (p_bovino_id IS NULL OR m.bovino_id=p_bovino_id)
      AND (m.finca_origen_id=p_finca_id OR m.finca_destino_id=p_finca_id OR (p_bovino_id IS NOT NULL AND b.finca_id=p_finca_id))
    ORDER BY m.fecha_movimiento DESC,m.created_at DESC,m.id DESC LIMIT p_limite OFFSET p_desde;
END $$;

-- Estado y finca no se modifican desde la ficha genérica ni mediante permisos de columna.
REVOKE UPDATE ON public.bovino FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(estado,finca_id) ON public.bovino FROM PUBLIC,anon,authenticated;
GRANT UPDATE(identificador_interno,nombre,raza,color) ON public.bovino TO authenticated;
ALTER TABLE public.movimiento_bovino ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.movimiento_bovino FROM PUBLIC,anon,authenticated;
DO $$ DECLARE cols text; BEGIN
  SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
    WHERE attrelid='public.movimiento_bovino'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT(%s),INSERT(%s),UPDATE(%s),REFERENCES(%s) ON public.movimiento_bovino FROM PUBLIC,anon,authenticated',cols,cols,cols,cols);
END $$;
REVOKE ALL ON FUNCTION private.registrar_asignacion_inicial(),private.validar_edicion_bovino(),
  public.registrar_movimiento_bovino(uuid,uuid,text,uuid,date,text,uuid),
  public.obtener_movimientos_bovinos(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_bovino(uuid,uuid,text,uuid,date,text,uuid),
  public.obtener_movimientos_bovinos(uuid,uuid,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
