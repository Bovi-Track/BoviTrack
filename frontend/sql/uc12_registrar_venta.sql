-- RF-UC12-01/02: registra venta, costo usado y estado final en una sola transacción.
-- Ejecutar después de uc14_control_acceso.sql.

ALTER TABLE public.registro_venta
  ADD COLUMN IF NOT EXISTS costo_compra_calculado numeric(18,2),
  ADD COLUMN IF NOT EXISTS mantenimiento_acumulado numeric(18,2);
ALTER TABLE public.registro_venta
  ALTER COLUMN rentabilidad_calculada DROP NOT NULL,
  ALTER COLUMN rentabilidad_calculada TYPE numeric(18,2);

-- Permite VENDIDO/BAJA/MUERTO únicamente después de guardar su evento correspondiente.
CREATE OR REPLACE FUNCTION private.validar_edicion_bovino() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.finca_id IS DISTINCT FROM OLD.finca_id THEN
    RAISE EXCEPTION 'Usa el flujo de traslado para cambiar de finca.';
  END IF;
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado IN ('ACTIVO','INACTIVO') AND NEW.estado IN ('ACTIVO','INACTIVO') THEN RETURN NEW; END IF;
  IF NEW.estado='VENDIDO' AND EXISTS(
    SELECT 1 FROM public.registro_venta v WHERE v.bovino_id=OLD.id
  ) THEN RETURN NEW; END IF;
  IF NEW.estado IN ('BAJA','MUERTO') AND EXISTS(
    SELECT 1 FROM public.registro_mortalidad m WHERE m.bovino_id=OLD.id
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'La venta o baja requiere registrar su evento.';
END $$;

CREATE OR REPLACE FUNCTION public.registrar_venta(
  p_bovino_id uuid,
  p_fecha_venta date,
  p_peso_salida_kg numeric,
  p_precio_kilo numeric,
  p_comprador_canal text,
  p_mantenimiento_diario numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_bovino public.bovino%ROWTYPE;
  v_usuario uuid;
  v_peso_inicial numeric;
  v_costo_compra numeric;
  v_mantenimiento numeric;
  v_ingreso numeric;
  v_rentabilidad numeric;
  v_id uuid := gen_random_uuid();
BEGIN
  IF p_bovino_id IS NULL OR p_fecha_venta IS NULL OR p_peso_salida_kg IS NULL
     OR p_precio_kilo IS NULL OR p_mantenimiento_diario IS NULL
     OR p_peso_salida_kg::text IN ('NaN','Infinity','-Infinity')
     OR p_precio_kilo::text IN ('NaN','Infinity','-Infinity')
     OR p_mantenimiento_diario::text IN ('NaN','Infinity','-Infinity')
     OR p_peso_salida_kg <= 0 OR p_precio_kilo <= 0 OR p_mantenimiento_diario < 0
     OR coalesce(btrim(p_comprador_canal),'')='' OR char_length(btrim(p_comprador_canal))>100 THEN
    RAISE EXCEPTION 'Completa datos válidos de venta y mantenimiento.';
  END IF;
  IF p_fecha_venta > CURRENT_DATE THEN RAISE EXCEPTION 'La fecha de venta no puede ser futura.'; END IF;

  SELECT b.* INTO v_bovino FROM public.bovino b WHERE b.id=p_bovino_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el toro.'; END IF;
  v_usuario := private.validar_acceso_finca(v_bovino.finca_id,true,true);
  IF v_bovino.estado IS DISTINCT FROM 'ACTIVO' THEN
    RAISE EXCEPTION 'Solo se puede vender un toro activo.';
  END IF;
  IF p_fecha_venta < v_bovino.fecha_ingreso THEN
    RAISE EXCEPTION 'La fecha de venta no puede ser anterior al ingreso del toro.';
  END IF;

  SELECT p.peso_kg INTO v_peso_inicial FROM public.pesaje p
    WHERE p.bovino_id=p_bovino_id AND p.es_inicial=true;
  IF v_bovino.compra_id IS NOT NULL AND v_bovino.precio_compra_kilo IS NOT NULL
     AND v_bovino.precio_compra_kilo>0 AND v_peso_inicial IS NOT NULL AND v_peso_inicial>0 THEN
    v_costo_compra := round(v_peso_inicial*v_bovino.precio_compra_kilo+
      coalesce(v_bovino.costo_flete_asignado,0),2);
  END IF;

  v_mantenimiento := round(p_mantenimiento_diario*(p_fecha_venta-v_bovino.fecha_ingreso),2);
  v_ingreso := round(p_peso_salida_kg*p_precio_kilo,2);
  IF v_costo_compra IS NOT NULL THEN
    v_rentabilidad := round(v_ingreso-v_costo_compra-v_mantenimiento,2);
  END IF;

  INSERT INTO public.registro_venta(
    id,bovino_id,registrado_por,fecha_venta,peso_salida_kg,precio_kilo,
    comprador_canal,rentabilidad_calculada,costo_compra_calculado,mantenimiento_acumulado
  ) VALUES (
    v_id,p_bovino_id,v_usuario,p_fecha_venta,p_peso_salida_kg,p_precio_kilo,
    btrim(p_comprador_canal),v_rentabilidad,v_costo_compra,v_mantenimiento
  );
  UPDATE public.bovino SET estado='VENDIDO' WHERE id=p_bovino_id;

  RETURN jsonb_build_object(
    'id',v_id,'bovino_id',p_bovino_id,'identificador_interno',v_bovino.identificador_interno,
    'nombre',v_bovino.nombre,'fecha_venta',p_fecha_venta,
    'peso_salida_kg',p_peso_salida_kg,'precio_kilo',p_precio_kilo,
    'comprador_canal',btrim(p_comprador_canal),'ingreso_bruto',v_ingreso,
    'costo_compra_calculado',v_costo_compra,'mantenimiento_acumulado',v_mantenimiento,
    'rentabilidad_calculada',v_rentabilidad,'registrado_por',v_usuario
  );
END $$;

CREATE OR REPLACE FUNCTION public.obtener_ventas_finca(p_finca_id uuid)
RETURNS TABLE(
  id uuid,bovino_id uuid,identificador_interno varchar,nombre varchar,
  fecha_venta date,peso_salida_kg numeric,precio_kilo numeric,comprador_canal varchar,
  rentabilidad_calculada numeric,costo_compra_calculado numeric,mantenimiento_acumulado numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.validar_acceso_finca(p_finca_id,true);
  RETURN QUERY SELECT v.id,v.bovino_id,b.identificador_interno,b.nombre,v.fecha_venta,
    v.peso_salida_kg,v.precio_kilo,v.comprador_canal,v.rentabilidad_calculada,
    v.costo_compra_calculado,v.mantenimiento_acumulado
    FROM public.registro_venta v JOIN public.bovino b ON b.id=v.bovino_id
    WHERE b.finca_id=p_finca_id ORDER BY v.fecha_venta DESC,v.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.registrar_venta(uuid,date,numeric,numeric,text,numeric),
  public.obtener_ventas_finca(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_venta(uuid,date,numeric,numeric,text,numeric),
  public.obtener_ventas_finca(uuid) TO authenticated;

-- No se habilitan grants directos sobre registro_venta; las operaciones usan las RPC anteriores.
