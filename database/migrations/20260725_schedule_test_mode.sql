IF COL_LENGTH('dbo.schedule_registration_periods','is_test') IS NULL
    ALTER TABLE dbo.schedule_registration_periods ADD is_test BIT NOT NULL
        CONSTRAINT DF_schedule_registration_periods_is_test DEFAULT 0;
GO

IF COL_LENGTH('dbo.employee_schedules','is_test') IS NULL
    ALTER TABLE dbo.employee_schedules ADD is_test BIT NOT NULL
        CONSTRAINT DF_employee_schedules_is_test DEFAULT 0;
GO

IF COL_LENGTH('dbo.attendance_logs','is_test') IS NULL
    ALTER TABLE dbo.attendance_logs ADD is_test BIT NOT NULL
        CONSTRAINT DF_attendance_logs_is_test DEFAULT 0;
GO

