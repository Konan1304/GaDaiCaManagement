SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.employee_shift_registrations','selection_code') IS NULL
    ALTER TABLE dbo.employee_shift_registrations ADD selection_code VARCHAR(10) NULL;

EXEC(N'UPDATE r SET selection_code=s.shift_code
FROM dbo.employee_shift_registrations r
JOIN dbo.shifts s ON s.id=r.shift_id
WHERE r.selection_code IS NULL;');

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name='UQ_employee_shift_registration')
    ALTER TABLE dbo.employee_shift_registrations DROP CONSTRAINT UQ_employee_shift_registration;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.employee_shift_registrations') AND name='shift_id' AND is_nullable=0)
    ALTER TABLE dbo.employee_shift_registrations ALTER COLUMN shift_id INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_shift_registration_selection')
    EXEC(N'ALTER TABLE dbo.employee_shift_registrations ADD CONSTRAINT CK_shift_registration_selection
    CHECK (selection_code IN (''OFF'',''FULL'',''A'',''B'',''P1'',''P2'',''P3''));');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.employee_shift_registrations') AND name='UQ_employee_shift_registration_day')
    CREATE UNIQUE INDEX UQ_employee_shift_registration_day
    ON dbo.employee_shift_registrations(period_id,employee_id,work_date);

IF COL_LENGTH('dbo.schedule_draft_assignments','display_code') IS NULL
    ALTER TABLE dbo.schedule_draft_assignments ADD display_code NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.schedule_draft_assignments','start_time_override') IS NULL
    ALTER TABLE dbo.schedule_draft_assignments ADD start_time_override TIME NULL;
IF COL_LENGTH('dbo.schedule_draft_assignments','end_time_override') IS NULL
    ALTER TABLE dbo.schedule_draft_assignments ADD end_time_override TIME NULL;

IF COL_LENGTH('dbo.employee_schedules','display_code') IS NULL
    ALTER TABLE dbo.employee_schedules ADD display_code NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.employee_schedules','start_time_override') IS NULL
    ALTER TABLE dbo.employee_schedules ADD start_time_override TIME NULL;
IF COL_LENGTH('dbo.employee_schedules','end_time_override') IS NULL
    ALTER TABLE dbo.employee_schedules ADD end_time_override TIME NULL;

COMMIT TRANSACTION;
