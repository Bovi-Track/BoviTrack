-- UC-01: ejecutar en Supabase SQL Editor con un rol propietario de las tablas.
-- Dependencias: public.perfil_usuario, public.usuario_finca, public.roles,
-- public.finca, public.compra_subasta (con id_usuario), public.bovino,
-- public.pesaje (con es_inicial) y public.movimiento_bovino.
-- Supone que el rol administrativo se llama exactamente 'ADMINISTRADOR'.
-- Esta función implementa UC-01; no cambia las políticas RLS ni los permisos
-- de escritura directa que ya existan sobre las tablas.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.registrar_compra_subasta_impl(
  p_id_subasta text,
  p_numero_factura text,
  p_fecha_compra date,
  p_costo_flete_total numeric,
  p_proveedor text,
  p_bovinos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_id_subasta text := nullif(btrim(p_id_subasta), '');
  v_factura text := nullif(btrim(p_numero_factura), '');
  v_proveedor text := nullif(btrim(p_proveedor), '');
  v_flete_total numeric := coalesce(p_costo_flete_total, 0);
  v_item jsonb;
  v_finca_id uuid;
  v_diio text;
  v_interno text;
  v_sexo text;
  v_peso numeric;
  v_precio numeric;
  v_fecha_ingreso date;
  v_fecha_nacimiento date;
  v_peso_total numeric := 0;
  v_peso_acumulado numeric := 0;
  v_flete_asignado numeric;
  v_subtotal_bovino numeric;
  v_subtotal_compra numeric := 0;
  v_cantidad integer := 0;
  v_compra_id uuid;
  v_bovino_id uuid;
  v_bovinos_resultado jsonb := '[]'::jsonb;
BEGIN
  IF v_usuario_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfil_usuario AS perfil
    WHERE perfil.id = v_usuario_id AND perfil.activo
  ) THEN
    RAISE EXCEPTION 'La cuenta no está activa o no está autenticada'
      USING ERRCODE = '42501';
  END IF;

  IF v_factura IS NULL OR p_fecha_compra IS NULL THEN
    RAISE EXCEPTION 'Factura y fecha de compra son obligatorias';
  END IF;

  IF v_id_subasta IS NULL AND v_proveedor IS NULL THEN
    RAISE EXCEPTION 'Indique una subasta o un proveedor';
  END IF;

  IF v_flete_total < 0 OR v_flete_total <> round(v_flete_total, 2) THEN
    RAISE EXCEPTION 'El flete debe ser un monto no negativo con dos decimales';
  END IF;

  IF p_bovinos IS NULL OR jsonb_typeof(p_bovinos) <> 'array' THEN
    RAISE EXCEPTION 'La compra debe incluir una lista de bovinos';
  END IF;

  IF jsonb_array_length(p_bovinos) = 0 THEN
    RAISE EXCEPTION 'La compra debe incluir al menos un bovino';
  END IF;

  -- Validar todo antes de crear la compra. Las restricciones UNIQUE de bovino
  -- también hacen fallar y revertir la transacción si un ID ya existe.
  FOR v_item IN
    SELECT elemento.value
    FROM jsonb_array_elements(p_bovinos) WITH ORDINALITY AS elemento(value, posicion)
    ORDER BY elemento.posicion
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Cada bovino debe ser un objeto';
    END IF;

    v_finca_id := nullif(v_item->>'finca_id', '')::uuid;
    v_diio := nullif(btrim(v_item->>'numero_diio'), '');
    v_interno := nullif(btrim(v_item->>'identificador_interno'), '');
    v_sexo := v_item->>'sexo';
    v_peso := nullif(v_item->>'peso_compra_kg', '')::numeric;
    v_precio := nullif(v_item->>'precio_compra_kilo', '')::numeric;
    v_fecha_ingreso := coalesce(
      nullif(v_item->>'fecha_ingreso', '')::date,
      p_fecha_compra
    );
    v_fecha_nacimiento := nullif(v_item->>'fecha_nacimiento', '')::date;

    IF v_finca_id IS NULL OR v_diio IS NULL OR v_interno IS NULL
       OR v_sexo IS NULL OR v_peso IS NULL OR v_precio IS NULL THEN
      RAISE EXCEPTION 'Faltan datos obligatorios de un bovino';
    END IF;

    IF v_sexo NOT IN ('MACHO', 'HEMBRA') THEN
      RAISE EXCEPTION 'Sexo de bovino inválido';
    END IF;

    IF v_peso <= 0 OR v_peso > 9999.99 OR v_peso <> round(v_peso, 2) THEN
      RAISE EXCEPTION 'El peso de compra debe ser positivo y tener dos decimales';
    END IF;

    IF v_precio <= 0 OR v_precio <> round(v_precio, 2) THEN
      RAISE EXCEPTION 'El precio por kilo debe ser positivo y tener dos decimales';
    END IF;

    IF v_fecha_ingreso < p_fecha_compra OR
       (v_fecha_nacimiento IS NOT NULL AND v_fecha_nacimiento > p_fecha_compra) THEN
      RAISE EXCEPTION 'Las fechas del bovino son inconsistentes con la compra';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.usuario_finca AS acceso
      JOIN public.roles AS rol ON rol.id = acceso.rol_id
      JOIN public.finca AS finca ON finca.id = acceso.finca_id
      WHERE acceso.usuario_id = v_usuario_id
        AND acceso.finca_id = v_finca_id
        AND rol.nombre = 'ADMINISTRADOR'
        AND finca.activo
    ) THEN
      RAISE EXCEPTION 'No puede registrar bovinos en una de las fincas seleccionadas'
        USING ERRCODE = '42501';
    END IF;

    v_peso_total := v_peso_total + v_peso;
  END LOOP;

  INSERT INTO public.compra_subasta (
    id_subasta, numero_factura, fecha_compra, costo_flete_total,
    proveedor, id_usuario
  ) VALUES (
    v_id_subasta, v_factura, p_fecha_compra, v_flete_total,
    v_proveedor, v_usuario_id
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN
    SELECT elemento.value
    FROM jsonb_array_elements(p_bovinos) WITH ORDINALITY AS elemento(value, posicion)
    ORDER BY elemento.posicion
  LOOP
    v_finca_id := (v_item->>'finca_id')::uuid;
    v_diio := btrim(v_item->>'numero_diio');
    v_interno := btrim(v_item->>'identificador_interno');
    v_peso := (v_item->>'peso_compra_kg')::numeric;
    v_precio := (v_item->>'precio_compra_kilo')::numeric;
    v_fecha_ingreso := coalesce(
      nullif(v_item->>'fecha_ingreso', '')::date,
      p_fecha_compra
    );

    -- Diferencia de acumulados redondeados: reparte centavos sin perderlos,
    -- sin asignaciones negativas y con suma final igual al flete total.
    v_flete_asignado :=
      round(v_flete_total * (v_peso_acumulado + v_peso) / v_peso_total, 2)
      - round(v_flete_total * v_peso_acumulado / v_peso_total, 2);
    v_peso_acumulado := v_peso_acumulado + v_peso;
    v_subtotal_bovino := round(v_peso * v_precio, 2);
    v_subtotal_compra := v_subtotal_compra + v_subtotal_bovino;

    INSERT INTO public.bovino (
      finca_id, compra_id, numero_diio, identificador_interno,
      nombre, raza, color, sexo, fecha_nacimiento, fecha_ingreso,
      precio_compra_kilo, costo_flete_asignado, estado
    ) VALUES (
      v_finca_id,
      v_compra_id,
      v_diio,
      v_interno,
      nullif(btrim(v_item->>'nombre'), ''),
      nullif(btrim(v_item->>'raza'), ''),
      nullif(btrim(v_item->>'color'), ''),
      v_item->>'sexo',
      nullif(v_item->>'fecha_nacimiento', '')::date,
      v_fecha_ingreso,
      v_precio,
      v_flete_asignado,
      'ACTIVO'
    ) RETURNING id INTO v_bovino_id;

    INSERT INTO public.pesaje (
      bovino_id, registrado_por, peso_kg, fecha_pesaje, es_inicial
    ) VALUES (
      v_bovino_id, v_usuario_id, v_peso, p_fecha_compra, true
    );

    INSERT INTO public.movimiento_bovino (
      bovino_id, finca_origen_id, finca_destino_id,
      registrado_por, tipo, fecha_movimiento
    ) VALUES (
      v_bovino_id, NULL, v_finca_id,
      v_usuario_id, 'ASIGNACION', v_fecha_ingreso
    );

    v_cantidad := v_cantidad + 1;
    v_bovinos_resultado := v_bovinos_resultado || jsonb_build_array(
      jsonb_build_object(
        'id', v_bovino_id,
        'finca_id', v_finca_id,
        'numero_diio', v_diio,
        'peso_compra_kg', v_peso,
        'precio_compra_kilo', v_precio,
        'costo_flete_asignado', v_flete_asignado,
        'costo_inicial', v_subtotal_bovino + v_flete_asignado
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'numero_factura', v_factura,
    'cantidad_bovinos', v_cantidad,
    'peso_total_kg', v_peso_total,
    'subtotal_animales', v_subtotal_compra,
    'costo_flete_total', v_flete_total,
    'costo_inicial_total', v_subtotal_compra + v_flete_total,
    'bovinos', v_bovinos_resultado
  );
END;
$$;

-- PostgREST solo expone public; el cuerpo privilegiado queda en private.
CREATE OR REPLACE FUNCTION public.registrar_compra_subasta(
  p_id_subasta text,
  p_numero_factura text,
  p_fecha_compra date,
  p_costo_flete_total numeric,
  p_proveedor text,
  p_bovinos jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.registrar_compra_subasta_impl(
    p_id_subasta, p_numero_factura, p_fecha_compra,
    p_costo_flete_total, p_proveedor, p_bovinos
  );
$$;

REVOKE ALL ON FUNCTION private.registrar_compra_subasta_impl(
  text, text, date, numeric, text, jsonb
) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.registrar_compra_subasta_impl(
  text, text, date, numeric, text, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_compra_subasta(
  text, text, date, numeric, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_compra_subasta(
  text, text, date, numeric, text, jsonb
) TO authenticated;

COMMIT;
