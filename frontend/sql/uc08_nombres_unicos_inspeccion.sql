-- Solo lectura: identifica nombres repetidos antes de aplicar la restricción.
SELECT finca_id,
       lower(btrim(regexp_replace(nombre, '[[:space:]]+', ' ', 'g'))) AS nombre_normalizado,
       jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'activo', activo)
                 ORDER BY nombre, id) AS insumos
FROM public.insumo
GROUP BY finca_id, lower(btrim(regexp_replace(nombre, '[[:space:]]+', ' ', 'g')))
HAVING count(*) > 1
ORDER BY finca_id, nombre_normalizado;
