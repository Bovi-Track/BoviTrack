-- UC-08/UC-09 y RF-TR-03 (solo bodega). Aplicar como propietario autorizado
-- de las tablas (Supabase SQL Editor / migración), nunca desde el navegador.
-- Antes de aplicar: revisar estructura, políticas, grants e integraciones actuales
-- de insumo y movimiento_inventario; obtener_roles() debe devolver únicamente
-- nombres reconocidos para los usuarios de este módulo. No renombra roles.
-- Los grants directos se revocan incluso si existen políticas RLS permisivas.
-- No modifica tablas/grants de otros módulos ni datos existentes.
-- Validación reproducible local: tests/inventory-sql.py (PostgreSQL temporal).
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
CREATE INDEX IF NOT EXISTS insumo_finca_idx ON public.insumo (finca_id);
CREATE INDEX IF NOT EXISTS movimiento_inventario_insumo_fecha_idx
  ON public.movimiento_inventario (insumo_id, fecha_movimiento, id);
ALTER TABLE public.insumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimiento_inventario ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.insumo, public.movimiento_inventario
  FROM PUBLIC, anon, authenticated;
-- También revocar grants de columna previos: un grant de tabla no los anula.
REVOKE SELECT (id, finca_id, nombre, tipo, unidad_medida, costo_unitario, activo, created_at),
  INSERT (id, finca_id, nombre, tipo, unidad_medida, costo_unitario, activo, created_at),
  UPDATE (id, finca_id, nombre, tipo, unidad_medida, costo_unitario, activo, created_at),
  REFERENCES (id, finca_id, nombre, tipo, unidad_medida, costo_unitario, activo, created_at)
  ON public.insumo FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, insumo_id, registrado_por, tipo, cantidad, costo_unitario, fecha_movimiento, observaciones, created_at),
  INSERT (id, insumo_id, registrado_por, tipo, cantidad, costo_unitario, fecha_movimiento, observaciones, created_at),
  UPDATE (id, insumo_id, registrado_por, tipo, cantidad, costo_unitario, fecha_movimiento, observaciones, created_at),
  REFERENCES (id, insumo_id, registrado_por, tipo, cantidad, costo_unitario, fecha_movimiento, observaciones, created_at)
  ON public.movimiento_inventario FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.validar_acceso_inventario(
  p_finca_id uuid, p_requiere_admin boolean, p_requiere_activa boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_rol text;
  v_activa boolean;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'INVENTARIO_SESION: Inicia sesión para consultar el inventario.' USING ERRCODE = '42501';
  END IF;
  SELECT upper(btrim(r.nombre)), f.activo INTO v_rol, v_activa
    FROM public.usuario_finca uf
    JOIN public.perfil_usuario p ON p.id = uf.usuario_id AND p.activo
    JOIN public.roles r ON r.id = uf.rol_id
    JOIN public.finca f ON f.id = uf.finca_id
    WHERE uf.usuario_id = v_usuario AND uf.finca_id = p_finca_id;
  IF v_rol IS NULL OR v_rol NOT IN ('ADMINISTRADOR', 'ADMINISTRADOR DE FINCA', 'PERSONAL_CAMPO', 'PERSONAL DE CAMPO') THEN
    RAISE EXCEPTION 'INVENTARIO_ACCESO: No tienes acceso al inventario de esta finca o tu cuenta está inactiva.' USING ERRCODE = '42501';
  END IF;
  IF p_requiere_admin AND v_rol NOT IN ('ADMINISTRADOR', 'ADMINISTRADOR DE FINCA') THEN
    RAISE EXCEPTION 'INVENTARIO_ADMIN: Esta operación requiere administrador de la finca.' USING ERRCODE = '42501';
  END IF;
  IF p_requiere_activa AND NOT v_activa THEN
    RAISE EXCEPTION 'INVENTARIO_FINCA_INACTIVA: La finca está inactiva; solo puedes consultar el historial.';
  END IF;
  RETURN v_usuario;
END;
$$;
REVOKE ALL ON FUNCTION private.validar_acceso_inventario(uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.obtener_inventario_finca(p_finca_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_resultado jsonb;
BEGIN
  PERFORM private.validar_acceso_inventario(p_finca_id, false);
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'finca_id', i.finca_id, 'nombre', i.nombre, 'tipo', i.tipo,
    'unidad_medida', i.unidad_medida, 'activo', i.activo, 'stock', coalesce(s.stock, 0)
  ) ORDER BY i.nombre, i.id), '[]'::jsonb) INTO v_resultado
  FROM public.insumo i
  LEFT JOIN LATERAL (
    SELECT sum(CASE WHEN m.tipo IN ('ENTRADA', 'AJUSTE_POSITIVO') THEN m.cantidad ELSE -m.cantidad END) AS stock
    FROM public.movimiento_inventario m WHERE m.insumo_id = i.id
  ) s ON true WHERE i.finca_id = p_finca_id;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_movimientos_insumo(
  p_insumo_id uuid, p_limite integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca uuid; v_resultado jsonb;
BEGIN
  SELECT i.finca_id INTO v_finca FROM public.insumo i WHERE i.id = p_insumo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVENTARIO_NO_EXISTE: El insumo no existe.'; END IF;
  PERFORM private.validar_acceso_inventario(v_finca, false);
  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'INVENTARIO_PAGINA: La página debe tener entre 1 y 100 registros y un desplazamiento válido.';
  END IF;
  WITH pagina AS (
    SELECT m.id, m.insumo_id, m.tipo, m.cantidad, m.fecha_movimiento, m.registrado_por,
      p.nombre_completo AS responsable_nombre, m.observaciones, m.created_at
    FROM public.movimiento_inventario m
    LEFT JOIN public.perfil_usuario p ON p.id = m.registrado_por
    WHERE m.insumo_id = p_insumo_id
    ORDER BY m.fecha_movimiento DESC, m.created_at DESC NULLS LAST, m.id DESC
    LIMIT p_limite OFFSET p_offset
  ) SELECT jsonb_build_object(
    'movimientos', coalesce((SELECT jsonb_agg(to_jsonb(pagina) ORDER BY fecha_movimiento DESC, created_at DESC NULLS LAST, id DESC) FROM pagina), '[]'::jsonb),
    'total', (SELECT count(*) FROM public.movimiento_inventario m WHERE m.insumo_id = p_insumo_id)
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_insumo(
  p_finca_id uuid, p_nombre text, p_tipo text, p_unidad_medida text, p_insumo_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_insumo record; v_id uuid; v_stock numeric;
BEGIN
  PERFORM private.validar_acceso_inventario(p_finca_id, true, true);
  IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 1 AND 100
    OR p_unidad_medida IS NULL OR length(btrim(p_unidad_medida)) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'INVENTARIO_CATALOGO: Nombre (1–100 caracteres) y unidad (1–20) son obligatorios.';
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('ALIMENTO', 'SUPLEMENTO', 'MEDICAMENTO', 'VACUNA') THEN
    RAISE EXCEPTION 'INVENTARIO_CATEGORIA: Selecciona una categoría válida.';
  END IF;
  IF p_insumo_id IS NULL THEN
    INSERT INTO public.insumo (finca_id, nombre, tipo, unidad_medida)
      VALUES (p_finca_id, btrim(p_nombre), p_tipo, btrim(p_unidad_medida)) RETURNING id INTO v_id;
  ELSE
    SELECT i.id, i.tipo, i.unidad_medida, i.activo INTO v_insumo FROM public.insumo i
      WHERE i.id = p_insumo_id AND i.finca_id = p_finca_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVENTARIO_NO_EXISTE: El insumo no existe en esta finca.'; END IF;
    PERFORM private.validar_acceso_inventario(p_finca_id, true, true);
    IF NOT v_insumo.activo THEN RAISE EXCEPTION 'INVENTARIO_INACTIVO: El insumo está inactivo.'; END IF;
    IF (v_insumo.tipo <> p_tipo OR v_insumo.unidad_medida <> btrim(p_unidad_medida))
      AND EXISTS (SELECT 1 FROM public.movimiento_inventario m WHERE m.insumo_id = p_insumo_id) THEN
      RAISE EXCEPTION 'INVENTARIO_HISTORIAL: No puedes cambiar la categoría ni la unidad de un insumo con movimientos.';
    END IF;
    UPDATE public.insumo SET nombre = btrim(p_nombre), tipo = p_tipo, unidad_medida = btrim(p_unidad_medida)
      WHERE id = p_insumo_id;
    v_id := p_insumo_id;
  END IF;
  SELECT coalesce(sum(CASE WHEN m.tipo IN ('ENTRADA', 'AJUSTE_POSITIVO') THEN m.cantidad ELSE -m.cantidad END), 0)
    INTO v_stock FROM public.movimiento_inventario m WHERE m.insumo_id = v_id;
  RETURN (SELECT jsonb_build_object('id', i.id, 'finca_id', i.finca_id, 'nombre', i.nombre,
    'tipo', i.tipo, 'unidad_medida', i.unidad_medida, 'activo', i.activo, 'stock', v_stock)
    FROM public.insumo i WHERE i.id = v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.desactivar_insumo(p_insumo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca uuid; v_stock numeric;
BEGIN
  SELECT i.finca_id INTO v_finca FROM public.insumo i WHERE i.id = p_insumo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVENTARIO_NO_EXISTE: El insumo no existe.'; END IF;
  PERFORM private.validar_acceso_inventario(v_finca, true, true);
  SELECT i.finca_id INTO v_finca FROM public.insumo i WHERE i.id = p_insumo_id FOR UPDATE;
  PERFORM private.validar_acceso_inventario(v_finca, true, true);
  UPDATE public.insumo SET activo = false WHERE id = p_insumo_id;
  SELECT coalesce(sum(CASE WHEN m.tipo IN ('ENTRADA', 'AJUSTE_POSITIVO') THEN m.cantidad ELSE -m.cantidad END), 0)
    INTO v_stock FROM public.movimiento_inventario m WHERE m.insumo_id = p_insumo_id;
  RETURN (SELECT jsonb_build_object('id', i.id, 'finca_id', i.finca_id, 'nombre', i.nombre,
    'tipo', i.tipo, 'unidad_medida', i.unidad_medida, 'activo', i.activo, 'stock', v_stock)
    FROM public.insumo i WHERE i.id = p_insumo_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
  p_insumo_id uuid, p_tipo text, p_cantidad numeric, p_fecha_movimiento date, p_observaciones text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_finca uuid; v_activo boolean; v_usuario uuid; v_stock numeric; v_id uuid;
BEGIN
  SELECT i.finca_id INTO v_finca FROM public.insumo i WHERE i.id = p_insumo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVENTARIO_NO_EXISTE: El insumo no existe.'; END IF;
  v_usuario := private.validar_acceso_inventario(v_finca, false, true);
  -- Todas las escrituras del módulo usan este mismo bloqueo por insumo.
  -- VOLATILE (predeterminado): el SUM posterior ve el commit de quien tuvo el bloqueo.
  SELECT i.finca_id, i.activo INTO v_finca, v_activo
    FROM public.insumo i WHERE i.id = p_insumo_id FOR UPDATE;
  v_usuario := private.validar_acceso_inventario(v_finca, false, true);
  IF NOT v_activo THEN RAISE EXCEPTION 'INVENTARIO_INACTIVO: El insumo está inactivo.'; END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('ENTRADA', 'SALIDA', 'CONSUMO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO') THEN
    RAISE EXCEPTION 'INVENTARIO_TIPO: Selecciona un tipo de movimiento válido.';
  END IF;
  IF p_fecha_movimiento IS NULL OR NOT isfinite(p_fecha_movimiento) THEN
    RAISE EXCEPTION 'INVENTARIO_FECHA: La fecha del movimiento es obligatoria y debe ser válida.';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_cantidad <= 0 OR p_cantidad > 99999999.99 OR trunc(p_cantidad, 2) <> p_cantidad THEN
    RAISE EXCEPTION 'INVENTARIO_CANTIDAD: Usa una cantidad positiva, hasta 99.999.999,99 y con máximo dos decimales.';
  END IF;
  SELECT coalesce(sum(CASE WHEN m.tipo IN ('ENTRADA', 'AJUSTE_POSITIVO') THEN m.cantidad ELSE -m.cantidad END), 0)
    INTO v_stock FROM public.movimiento_inventario m WHERE m.insumo_id = p_insumo_id;
  v_stock := v_stock + CASE WHEN p_tipo IN ('ENTRADA', 'AJUSTE_POSITIVO') THEN p_cantidad ELSE -p_cantidad END;
  IF v_stock < 0 THEN RAISE EXCEPTION 'INVENTARIO_SALDO: Saldo insuficiente para registrar este movimiento.'; END IF;
  INSERT INTO public.movimiento_inventario (insumo_id, registrado_por, tipo, cantidad, fecha_movimiento, observaciones)
    VALUES (p_insumo_id, v_usuario, p_tipo, p_cantidad, p_fecha_movimiento, nullif(btrim(p_observaciones), ''))
    RETURNING id INTO v_id;
  RETURN (SELECT jsonb_build_object('stock', v_stock, 'movimiento', jsonb_build_object(
    'id', m.id, 'insumo_id', m.insumo_id, 'tipo', m.tipo, 'cantidad', m.cantidad,
    'fecha_movimiento', m.fecha_movimiento, 'registrado_por', m.registrado_por,
    'responsable_nombre', p.nombre_completo, 'observaciones', m.observaciones, 'created_at', m.created_at))
    FROM public.movimiento_inventario m LEFT JOIN public.perfil_usuario p ON p.id = m.registrado_por WHERE m.id = v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_reporte_inventario(p_finca_id uuid, p_desde date, p_hasta date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_resultado jsonb;
BEGIN
  PERFORM private.validar_acceso_inventario(p_finca_id, true);
  IF p_desde IS NULL OR p_hasta IS NULL OR NOT isfinite(p_desde) OR NOT isfinite(p_hasta) OR p_desde > p_hasta THEN
    RAISE EXCEPTION 'INVENTARIO_PERIODO: Selecciona fechas válidas con Desde menor o igual a Hasta.';
  END IF;
  -- Una sola consulta y snapshot para catálogo, saldos y detalle completo.
  WITH items AS MATERIALIZED (
    SELECT i.id, i.nombre, i.tipo, i.unidad_medida, i.activo FROM public.insumo i
    WHERE i.finca_id = p_finca_id AND (i.activo OR EXISTS (
      SELECT 1 FROM public.movimiento_inventario m WHERE m.insumo_id = i.id AND m.fecha_movimiento <= p_hasta))
  ), historial AS MATERIALIZED (
    SELECT m.id, m.insumo_id, m.tipo, m.cantidad, m.fecha_movimiento, m.registrado_por,
      m.observaciones, m.created_at, i.nombre AS insumo_nombre, i.unidad_medida,
      p.nombre_completo AS responsable_nombre,
      CASE WHEN m.tipo IN ('ENTRADA', 'AJUSTE_POSITIVO') THEN m.cantidad ELSE -m.cantidad END AS delta
    FROM public.movimiento_inventario m JOIN items i ON i.id = m.insumo_id
    LEFT JOIN public.perfil_usuario p ON p.id = m.registrado_por
    WHERE m.fecha_movimiento <= p_hasta
  ), resumen AS (
    SELECT i.id AS insumo_id, i.nombre, i.tipo, i.unidad_medida, i.activo,
      coalesce(sum(h.delta) FILTER (WHERE h.fecha_movimiento < p_desde), 0) AS saldo_inicial,
      coalesce(sum(h.cantidad) FILTER (WHERE h.fecha_movimiento >= p_desde AND h.tipo = 'ENTRADA'), 0) AS entradas,
      coalesce(sum(h.cantidad) FILTER (WHERE h.fecha_movimiento >= p_desde AND h.tipo = 'SALIDA'), 0) AS salidas,
      coalesce(sum(h.cantidad) FILTER (WHERE h.fecha_movimiento >= p_desde AND h.tipo = 'CONSUMO'), 0) AS consumos,
      coalesce(sum(h.cantidad) FILTER (WHERE h.fecha_movimiento >= p_desde AND h.tipo = 'AJUSTE_POSITIVO'), 0) AS ajustes_positivos,
      coalesce(sum(h.cantidad) FILTER (WHERE h.fecha_movimiento >= p_desde AND h.tipo = 'AJUSTE_NEGATIVO'), 0) AS ajustes_negativos,
      coalesce(sum(h.delta), 0) AS saldo_final
    FROM items i LEFT JOIN historial h ON h.insumo_id = i.id
    GROUP BY i.id, i.nombre, i.tipo, i.unidad_medida, i.activo
  ), detalle AS (
    SELECT h.id, h.insumo_id, h.insumo_nombre, h.unidad_medida, h.tipo, h.cantidad,
      h.fecha_movimiento, h.registrado_por, h.responsable_nombre, h.observaciones, h.created_at
    FROM historial h WHERE h.fecha_movimiento >= p_desde
  ) SELECT jsonb_build_object('finca_id', p_finca_id,
    'finca_nombre', (SELECT f.nombre FROM public.finca f WHERE f.id = p_finca_id),
    'desde', p_desde, 'hasta', p_hasta,
    'resumen', coalesce((SELECT jsonb_agg(to_jsonb(resumen) ORDER BY nombre, insumo_id) FROM resumen), '[]'::jsonb),
    'movimientos', coalesce((SELECT jsonb_agg(to_jsonb(detalle) ORDER BY fecha_movimiento, created_at NULLS LAST, id) FROM detalle), '[]'::jsonb)
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_inventario_finca(uuid),
  public.obtener_movimientos_insumo(uuid, integer, integer),
  public.guardar_insumo(uuid, text, text, text, uuid), public.desactivar_insumo(uuid),
  public.registrar_movimiento_inventario(uuid, text, numeric, date, text),
  public.obtener_reporte_inventario(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_inventario_finca(uuid),
  public.obtener_movimientos_insumo(uuid, integer, integer),
  public.guardar_insumo(uuid, text, text, text, uuid), public.desactivar_insumo(uuid),
  public.registrar_movimiento_inventario(uuid, text, numeric, date, text),
  public.obtener_reporte_inventario(uuid, date, date) TO authenticated;
COMMIT;
-- Tras aplicar: verificar propietario/SECURITY DEFINER/search_path de las 7
-- funciones, RLS y privilegios directos (incluidos TRUNCATE y columnas).
-- Aceptación real: usar sesiones admin/campo/inactiva/no miembro, dos conexiones
-- simultáneas y la UI contra esta base. Pruebas locales no sustituyen ese paso.
