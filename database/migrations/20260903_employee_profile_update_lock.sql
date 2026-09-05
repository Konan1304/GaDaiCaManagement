IF COL_LENGTH('dbo.employees','profile_update_locked') IS NULL
BEGIN
  ALTER TABLE dbo.employees ADD profile_update_locked BIT NOT NULL
    CONSTRAINT DF_employees_profile_update_locked DEFAULT 0;
END
GO
