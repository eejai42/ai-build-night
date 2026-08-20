-- ============================================================================
-- 99-fk-constraints.sql — FK CONSTRAINTS (off by default)
-- ============================================================================
-- Demos must never fail on FK violations, so init-db.sh SKIPS this file
-- unless EFFORTLESS_ENFORCE_FKS=true is set in the environment.
--
--   EFFORTLESS_ENFORCE_FKS=true bash init-db.sh    # apply constraints
--   bash init-db.sh                                # leave them documented but unenforced
--
-- The rulebook always documents the FK relationships, and 01-drop-and-create-tables.sql
-- always installs the supporting indexes inline. This file just declares the actual
-- enforcement. Idempotent: every constraint is dropped if present, then added.
-- ============================================================================

-- Axes
ALTER TABLE axes DROP CONSTRAINT IF EXISTS fk_axes_scenarios;
ALTER TABLE axes ADD CONSTRAINT fk_axes_scenarios
  FOREIGN KEY (scenarios) REFERENCES scenarios (scenario_id);
ALTER TABLE axes DROP CONSTRAINT IF EXISTS fk_axes_considerations;
ALTER TABLE axes ADD CONSTRAINT fk_axes_considerations
  FOREIGN KEY (considerations) REFERENCES considerations (consideration_id);

-- Scenarios
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS fk_scenarios_axis;
ALTER TABLE scenarios ADD CONSTRAINT fk_scenarios_axis
  FOREIGN KEY (axis) REFERENCES axes (axis_id);

-- Considerations
ALTER TABLE considerations DROP CONSTRAINT IF EXISTS fk_considerations_axis;
ALTER TABLE considerations ADD CONSTRAINT fk_considerations_axis
  FOREIGN KEY (axis) REFERENCES axes (axis_id);

-- 4 FK constraint(s) declared (off unless EFFORTLESS_ENFORCE_FKS=true).
