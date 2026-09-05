IF COL_LENGTH('dbo.employees','employment_type') IS NULL
BEGIN
  ALTER TABLE dbo.employees ADD employment_type VARCHAR(20) NULL;
  ALTER TABLE dbo.employees ADD CONSTRAINT CK_employees_employment_type
    CHECK (employment_type IS NULL OR employment_type IN ('part_time','full_time'));
END;
GO
