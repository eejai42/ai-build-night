# Rulebook to PostgreSQL Script Generation Report

**Schema:** `public`
**Database:** `demo`
**Timestamp:** 2026-08-20 23:47:12 UTC

## Parsing Rulebook

Found **3** tables in rulebook


  - **Axes** (9 fields, 1 records)
  - **Scenarios** (6 fields, 1 records)
  - **Considerations** (7 fields, 4 records)

Generated **3** table definitions with **9** raw fields (mode=check-add)
Generated **15** calculation functions
Generated **3** views
Enabled RLS on **3** tables
Generated insert statements for **6** records
## Script Generation Complete

Generated files:
- `00-bootstrap.sql` - Bootstrap (overwrite Never); includes commented-out drop-all script
- `01-drop-and-create-tables.sql` - Drop and recreate tables with raw fields and FK indexes
- `02-create-functions.sql` - Create calculation functions
- `03-create-views.sql` - Create views with calculated fields
- `04-create-policies.sql` - Create RLS policies
- `05-insert-data.sql` - Insert data from rulebook
- `99-fk-constraints.sql` - FK constraints (skipped unless EFFORTLESS_ENFORCE_FKS=true)
- `init-db.sh` - Database initialization script

