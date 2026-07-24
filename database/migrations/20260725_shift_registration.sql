SET XACT_ABORT ON;

IF COL_LENGTH('dbo.shifts','shift_type') IS NULL
  ALTER TABLE dbo.shifts ADD shift_type VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_shifts_type')
  ALTER TABLE dbo.shifts ADD CONSTRAINT CK_shifts_type CHECK (shift_type IS NULL OR shift_type IN ('full_time','part_time'));
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.schedule_registration_periods','U') IS NULL
BEGIN
  CREATE TABLE dbo.schedule_registration_periods(
    id INT IDENTITY(1,1) PRIMARY KEY, branch_id INT NOT NULL, title NVARCHAR(200) NOT NULL,
    week_start_date DATE NOT NULL, week_end_date DATE NOT NULL,
    registration_open_at DATETIME2 NOT NULL, registration_close_at DATETIME2 NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', created_by INT NOT NULL, locked_by INT NULL,
    locked_at DATETIME2 NULL, published_by INT NULL, published_at DATETIME2 NULL,
    note NVARCHAR(1000) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_registration_period_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_registration_period_creator FOREIGN KEY(created_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_registration_period_locker FOREIGN KEY(locked_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_registration_period_publisher FOREIGN KEY(published_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_registration_period_status CHECK(status IN ('draft','open','locked','published','cancelled')),
    CONSTRAINT UQ_registration_period_branch_week UNIQUE(branch_id,week_start_date),
    CONSTRAINT CK_registration_period_week CHECK(DATEDIFF(day,week_start_date,week_end_date)=6)
  );
END;

IF OBJECT_ID('dbo.employee_shift_registrations','U') IS NULL
BEGIN
  CREATE TABLE dbo.employee_shift_registrations(
    id BIGINT IDENTITY(1,1) PRIMARY KEY, period_id INT NOT NULL, employee_id INT NOT NULL,
    work_date DATE NOT NULL, shift_id INT NOT NULL, preference_level VARCHAR(20) NOT NULL DEFAULT 'available',
    note NVARCHAR(500) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_shift_registration_period FOREIGN KEY(period_id) REFERENCES dbo.schedule_registration_periods(id),
    CONSTRAINT FK_shift_registration_employee FOREIGN KEY(employee_id) REFERENCES dbo.employees(id),
    CONSTRAINT FK_shift_registration_shift FOREIGN KEY(shift_id) REFERENCES dbo.shifts(id),
    CONSTRAINT UQ_employee_shift_registration UNIQUE(period_id,employee_id,work_date,shift_id),
    CONSTRAINT CK_shift_registration_preference CHECK(preference_level IN ('preferred','available'))
  );
  CREATE INDEX IX_shift_registration_period_employee ON dbo.employee_shift_registrations(period_id,employee_id);
END;

MERGE dbo.shifts AS target
USING (VALUES
 ('A',N'Ca A','08:00','16:00','full_time'),
 ('B',N'Ca B','16:00','23:00','full_time'),
 ('P1',N'Ca P1','08:00','12:00','part_time'),
 ('P2',N'Ca P2','12:00','17:00','part_time'),
 ('P3',N'Ca P3','17:00','23:00','part_time')
) AS source(code,name,start_time,end_time,shift_type)
ON target.shift_code=source.code
WHEN MATCHED THEN UPDATE SET shift_name=source.name,start_time=source.start_time,end_time=source.end_time,shift_type=source.shift_type,status='active'
WHEN NOT MATCHED THEN INSERT(shift_code,shift_name,start_time,end_time,break_minutes,status,shift_type)
VALUES(source.code,source.name,source.start_time,source.end_time,0,'active',source.shift_type);

COMMIT;
