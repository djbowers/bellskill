-- Search-friendly view with snake_case columns so PostgREST can filter on item count.
CREATE OR REPLACE VIEW public.movements_catalog
WITH (security_invoker = true)
AS
SELECT
  id,
  "Movement" AS name,
  "Primary Equipment" AS primary_equipment,
  "# Primary Items" AS primary_item_count,
  "Single or Double Arm" AS single_or_double_arm
FROM public.movements;

GRANT SELECT ON public.movements_catalog TO authenticated;
