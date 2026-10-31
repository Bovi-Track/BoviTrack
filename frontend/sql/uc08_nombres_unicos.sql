-- RF-UC08-01: un nombre por finca, incluidos insumos inactivos.
-- Aplicar como propietario en Supabase después de revisar
-- uc08_nombres_unicos_inspeccion.sql. No fusiona ni borra datos.
-- Si hay duplicados, corregir sus nombres tras revisar el historial y reintentar.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS insumo_finca_nombre_unico_idx
  ON public.insumo (
    finca_id,
    lower(btrim(regexp_replace(nombre, '[[:space:]]+', ' ', 'g')))
  );

COMMIT;
