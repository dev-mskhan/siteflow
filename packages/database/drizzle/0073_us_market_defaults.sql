-- Update organization_settings defaults to US market
ALTER TABLE app.organization_settings ALTER COLUMN timezone SET DEFAULT 'America/New_York';
ALTER TABLE app.organization_settings ALTER COLUMN unit_system SET DEFAULT 'IMPERIAL';
ALTER TABLE app.organization_settings ALTER COLUMN week_starts_on SET DEFAULT 0;
ALTER TABLE app.organization_settings ALTER COLUMN date_format SET DEFAULT 'MM_DD_YYYY';
ALTER TABLE app.organization_settings ALTER COLUMN time_format SET DEFAULT 'H12';
