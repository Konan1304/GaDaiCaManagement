SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_registration_period_week')
  ALTER TABLE dbo.schedule_registration_periods DROP CONSTRAINT CK_registration_period_week;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_registration_period_date_range')
  ALTER TABLE dbo.schedule_registration_periods ADD CONSTRAINT CK_registration_period_date_range
  CHECK (week_end_date >= week_start_date);

IF OBJECT_ID('dbo.schedule_draft_assignments','U') IS NULL
BEGIN
  CREATE TABLE dbo.schedule_draft_assignments(
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    period_id INT NOT NULL,
    employee_id INT NOT NULL,
    work_date DATE NOT NULL,
    shift_id INT NOT NULL,
    work_position NVARCHAR(100) NULL,
    note NVARCHAR(500) NULL,
    created_by INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_schedule_draft_period FOREIGN KEY(period_id) REFERENCES dbo.schedule_registration_periods(id),
    CONSTRAINT FK_schedule_draft_employee FOREIGN KEY(employee_id) REFERENCES dbo.employees(id),
    CONSTRAINT FK_schedule_draft_shift FOREIGN KEY(shift_id) REFERENCES dbo.shifts(id),
    CONSTRAINT FK_schedule_draft_creator FOREIGN KEY(created_by) REFERENCES dbo.users(id),
    CONSTRAINT UQ_schedule_draft_assignment UNIQUE(period_id,employee_id,work_date)
  );
END;

COMMIT;
