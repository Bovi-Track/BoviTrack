-- Permite registrar bovinos sin número DIIO-SENASA.
ALTER TABLE public.bovino
  ALTER COLUMN numero_diio DROP NOT NULL;
