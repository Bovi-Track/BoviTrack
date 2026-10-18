-- RF-UC13-01: ejecutar después de uc14_control_acceso.sql y uc12_registrar_venta.sql.
-- Comprobar primero uc13_inspeccion.sql en Supabase. Conserva eventos e historial.
BEGIN;
LOCK TABLE public.bovino IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.registro_mortalidad
  ALTER COLUMN perdida_economica DROP NOT NULL,
  ALTER COLUMN perdida_economica TYPE numeric(18,2),
  ADD COLUMN IF NOT EXISTS costo_compra_calculado numeric(18,2),
  ADD COLUMN IF NOT EXISTS mantenimiento_diario numeric(18,2),
  ADD COLUMN IF NOT EXISTS mantenimiento_acumulado numeric(18,2),
  ADD COLUMN IF NOT EXISTS calculado_por uuid REFERENCES public.perfil_usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculado_en timestamptz;

-- El trigger de UC-12 exige el evento existente también para esta normalización.
UPDATE public.bovino SET estado='BAJA' WHERE estado='MUERTO';
ALTER TABLE public.bovino DROP CONSTRAINT IF EXISTS bovino_estado_check;
ALTER TABLE public.bovino ADD CONSTRAINT bovino_estado_check
  CHECK (estado IN ('ACTIVO','INACTIVO','VENDIDO','BAJA'));

-- Un evento terminal cierra el toro; la edición de su ficha sigue permitida.
CREATE OR REPLACE FUNCTION private.validar_edicion_bovino() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.finca_id IS DISTINCT FROM OLD.finca_id THEN
    RAISE EXCEPTION 'Usa el flujo de traslado para cambiar de finca.';
  END IF;
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado IN ('VENDIDO','BAJA') THEN
    RAISE EXCEPTION 'Un toro vendido o dado de baja no puede cambiar de estado.';
  END IF;
  IF OLD.estado IN ('ACTIVO','INACTIVO') AND NEW.estado IN ('ACTIVO','INACTIVO') THEN RETURN NEW; END IF;
  IF OLD.estado='ACTIVO' AND NEW.estado='VENDIDO'
    AND EXISTS(SELECT 1 FROM public.registro_venta WHERE bovino_id=OLD.id)
    AND NOT EXISTS(SELECT 1 FROM public.registro_mortalidad WHERE bovino_id=OLD.id) THEN RETURN NEW; END IF;
  IF OLD.estado='ACTIVO' AND NEW.estado='BAJA'
    AND EXISTS(SELECT 1 FROM public.registro_mortalidad WHERE bovino_id=OLD.id)
    AND NOT EXISTS(SELECT 1 FROM public.registro_venta WHERE bovino_id=OLD.id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'La venta o baja requiere un toro activo y su evento correspondiente.';
END $$;

-- Calcula y conserva los costos disponibles; la ausencia de compra o flete mantiene la pérdida pendiente.
CREATE OR REPLACE FUNCTION private.calcular_perdida_baja(p_baja_id uuid,p_mantenimiento_diario numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_bovino public.bovino%ROWTYPE;
  v_baja public.registro_mortalidad%ROWTYPE;
  v_usuario uuid;
  v_peso numeric;
  v_compra numeric;
  v_mantenimiento numeric;
BEGIN
  SELECT b.* INTO v_bovino FROM public.bovino b
    JOIN public.registro_mortalidad m ON m.bovino_id=b.id WHERE m.id=p_baja_id FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la baja.'; END IF;
  v_usuario := private.validar_acceso_finca(v_bovino.finca_id,true,true);
  SELECT * INTO v_baja FROM public.registro_mortalidad WHERE id=p_baja_id FOR UPDATE;
  IF v_bovino.estado IS DISTINCT FROM 'BAJA' THEN RAISE EXCEPTION 'El toro no está dado de baja.'; END IF;
  IF v_baja.perdida_economica IS NOT NULL THEN RAISE EXCEPTION 'La pérdida ya fue calculada y se conserva en el historial.'; END IF;
  IF p_mantenimiento_diario IS NULL OR p_mantenimiento_diario < 0
    OR p_mantenimiento_diario::text IN ('NaN','Infinity','-Infinity')
    OR p_mantenimiento_diario <> round(p_mantenimiento_diario,2) THEN
    RAISE EXCEPTION 'Indica un mantenimiento diario válido, igual o mayor que cero y con hasta dos decimales.';
  END IF;
  SELECT peso_kg INTO v_peso FROM public.pesaje WHERE bovino_id=v_bovino.id AND es_inicial;
  IF v_bovino.compra_id IS NOT NULL AND v_bovino.precio_compra_kilo>0 AND v_peso>0
     AND v_bovino.costo_flete_asignado IS NOT NULL AND v_bovino.costo_flete_asignado>=0 THEN
    v_compra := round(v_peso*v_bovino.precio_compra_kilo+v_bovino.costo_flete_asignado,2);
  END IF;
  v_mantenimiento := round(p_mantenimiento_diario*(v_baja.fecha_baja-v_bovino.fecha_ingreso),2);
  UPDATE public.registro_mortalidad SET costo_compra_calculado=v_compra,
    mantenimiento_diario=p_mantenimiento_diario,mantenimiento_acumulado=v_mantenimiento,
    perdida_economica=v_compra+v_mantenimiento,calculado_por=v_usuario,calculado_en=now()
    WHERE id=p_baja_id;
END $$;

-- RF-UC13-01: captura operativa online para ambos roles, sin devolver información económica.
CREATE OR REPLACE FUNCTION public.registrar_baja(
  p_bovino_id uuid,p_fecha_baja date,p_causa text,p_mantenimiento_diario numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_bovino public.bovino%ROWTYPE; v_usuario uuid; v_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_bovino FROM public.bovino WHERE id=p_bovino_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el toro.'; END IF;
  v_usuario := private.validar_acceso_finca(v_bovino.finca_id,false,true);
  IF p_mantenimiento_diario IS NOT NULL THEN
    PERFORM private.validar_acceso_finca(v_bovino.finca_id,true,true);
  END IF;
  IF v_bovino.estado IS DISTINCT FROM 'ACTIVO' THEN RAISE EXCEPTION 'Solo se puede dar de baja un toro activo.'; END IF;
  IF p_fecha_baja IS NULL OR p_fecha_baja>CURRENT_DATE OR p_fecha_baja<v_bovino.fecha_ingreso THEN
    RAISE EXCEPTION 'La fecha de baja debe estar entre el ingreso del toro y hoy.';
  END IF;
  IF coalesce(btrim(p_causa),'')='' OR char_length(btrim(p_causa))>2000 THEN
    RAISE EXCEPTION 'Indica una causa de baja de hasta 2000 caracteres.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.registro_venta WHERE bovino_id=p_bovino_id)
     OR EXISTS(SELECT 1 FROM public.registro_mortalidad WHERE bovino_id=p_bovino_id) THEN
    RAISE EXCEPTION 'El toro ya tiene una venta o baja registrada.';
  END IF;
  INSERT INTO public.registro_mortalidad(id,bovino_id,registrado_por,fecha_baja,causa_medica,perdida_economica)
    VALUES(v_id,p_bovino_id,v_usuario,p_fecha_baja,btrim(p_causa),NULL);
  UPDATE public.bovino SET estado='BAJA' WHERE id=p_bovino_id;
  IF p_mantenimiento_diario IS NOT NULL THEN PERFORM private.calcular_perdida_baja(v_id,p_mantenimiento_diario); END IF;
  RETURN v_id;
END $$;

-- RF-UC13-01: el administrador completa la pérdida pendiente sin modificar fecha, causa ni responsable.
CREATE OR REPLACE FUNCTION public.completar_perdida_baja(p_baja_id uuid,p_mantenimiento_diario numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN PERFORM private.calcular_perdida_baja(p_baja_id,p_mantenimiento_diario); END $$;

-- RF-UC13-01: el historial operativo está disponible para ambos roles, sin columnas financieras.
CREATE OR REPLACE FUNCTION public.obtener_bajas_bovino(p_bovino_id uuid)
RETURNS TABLE(id uuid,bovino_id uuid,fecha_baja date,causa text,registrado_por uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca uuid;
BEGIN
  SELECT finca_id INTO v_finca FROM public.bovino WHERE public.bovino.id=p_bovino_id;
  PERFORM private.validar_acceso_finca(v_finca,false);
  RETURN QUERY SELECT m.id,m.bovino_id,m.fecha_baja,m.causa_medica,m.registrado_por
    FROM public.registro_mortalidad m WHERE m.bovino_id=p_bovino_id ORDER BY m.fecha_baja DESC,m.created_at DESC;
END $$;

-- RF-UC13-01: los importes y snapshots solo se consultan como administrador de la finca.
CREATE OR REPLACE FUNCTION public.obtener_perdida_baja(p_baja_id uuid)
RETURNS TABLE(perdida_economica numeric,costo_compra_calculado numeric,mantenimiento_diario numeric,
  mantenimiento_acumulado numeric,calculado_por uuid,calculado_en timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca uuid;
BEGIN
  SELECT b.finca_id INTO v_finca FROM public.bovino b JOIN public.registro_mortalidad m ON m.bovino_id=b.id WHERE m.id=p_baja_id;
  PERFORM private.validar_acceso_finca(v_finca,true);
  RETURN QUERY SELECT m.perdida_economica,m.costo_compra_calculado,m.mantenimiento_diario,
    m.mantenimiento_acumulado,m.calculado_por,m.calculado_en FROM public.registro_mortalidad m WHERE m.id=p_baja_id;
END $$;

ALTER TABLE public.registro_mortalidad ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.registro_mortalidad FROM PUBLIC,anon,authenticated;
-- Incluye grants heredados de columna; no se habilita ninguna ruta directa al historial.
DO $$ DECLARE cols text; BEGIN
  SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
    WHERE attrelid='public.registro_mortalidad'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT(%s),INSERT(%s),UPDATE(%s),REFERENCES(%s) ON public.registro_mortalidad FROM PUBLIC,anon,authenticated',cols,cols,cols,cols);
END $$;
REVOKE ALL ON FUNCTION private.calcular_perdida_baja(uuid,numeric),private.validar_edicion_bovino(),
  public.registrar_baja(uuid,date,text,numeric),public.completar_perdida_baja(uuid,numeric),
  public.obtener_bajas_bovino(uuid),public.obtener_perdida_baja(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_baja(uuid,date,text,numeric),public.completar_perdida_baja(uuid,numeric),
  public.obtener_bajas_bovino(uuid),public.obtener_perdida_baja(uuid) TO authenticated;
COMMIT;
