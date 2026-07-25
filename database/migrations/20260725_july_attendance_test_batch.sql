IF COL_LENGTH('dbo.schedule_registration_periods','import_tag') IS NULL
    ALTER TABLE dbo.schedule_registration_periods ADD import_tag VARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.employee_schedules','import_tag') IS NULL
    ALTER TABLE dbo.employee_schedules ADD import_tag VARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.attendance_logs','import_tag') IS NULL
    ALTER TABLE dbo.attendance_logs ADD import_tag VARCHAR(80) NULL;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_employee_schedules_import_tag' AND object_id=OBJECT_ID('dbo.employee_schedules'))
    CREATE INDEX IX_employee_schedules_import_tag ON dbo.employee_schedules(import_tag,is_test);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_attendance_logs_import_tag' AND object_id=OBJECT_ID('dbo.attendance_logs'))
    CREATE INDEX IX_attendance_logs_import_tag ON dbo.attendance_logs(import_tag,is_test);
GO
