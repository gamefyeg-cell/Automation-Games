-- Lets the publish flow upsert on (game_id, game_region_id): re-publishing
-- the same opportunity (e.g. after a Steam price change) updates the
-- existing listing instead of creating a duplicate product row.
alter table public.products
  add constraint products_game_region_unique unique (game_id, game_region_id);
