IF COL_LENGTH('dbo.attendance_logs','branch_id') IS NULL
    ALTER TABLE dbo.attendance_logs ADD branch_id INT NULL;
IF COL_LENGTH('dbo.attendance_logs','work_date') IS NULL
    ALTER TABLE dbo.attendance_logs ADD work_date DATE NULL;
IF COL_LENGTH('dbo.attendance_logs','check_in_time') IS NULL
    ALTER TABLE dbo.attendance_logs ADD check_in_time DATETIME2 NULL;
IF COL_LENGTH('dbo.attendance_logs','check_out_time') IS NULL
    ALTER TABLE dbo.attendance_logs ADD check_out_time DATETIME2 NULL;
IF COL_LENGTH('dbo.attendance_logs','worked_minutes') IS NULL
    ALTER TABLE dbo.attendance_logs ADD worked_minutes INT NULL;
IF COL_LENGTH('dbo.attendance_logs','late_minutes') IS NULL
    ALTER TABLE dbo.attendance_logs ADD late_minutes INT NOT NULL CONSTRAINT DF_attendance_late_minutes DEFAULT 0;
IF COL_LENGTH('dbo.attendance_logs','early_leave_minutes') IS NULL
    ALTER TABLE dbo.attendance_logs ADD early_leave_minutes INT NOT NULL CONSTRAINT DF_attendance_early_minutes DEFAULT 0;
IF COL_LENGTH('dbo.attendance_logs','status') IS NULL
    ALTER TABLE dbo.attendance_logs ADD status VARCHAR(30) NULL;
IF COL_LENGTH('dbo.attendance_logs','updated_at') IS NULL
    ALTER TABLE dbo.attendance_logs ADD updated_at DATETIME2 NULL;
GO

UPDATE al
SET branch_id=COALESCE(al.branch_id,es.branch_id),
    work_date=COALESCE(al.work_date,CAST(al.attendance_time AS date)),
    check_in_time=CASE WHEN al.attendance_type='check_in' THEN COALESCE(al.check_in_time,al.attendance_time) ELSE al.check_in_time END,
    status=COALESCE(al.status,CASE WHEN al.attendance_type='check_in' THEN 'working' ELSE 'event' END)
FROM dbo.attendance_logs al
LEFT JOIN dbo.employee_schedules es ON es.id=al.schedule_id
WHERE al.work_date IS NULL OR al.branch_id IS NULL OR al.status IS NULL
   OR (al.attendance_type='check_in' AND al.check_in_time IS NULL);
GO

UPDATE ci
SET check_out_time=paired.check_out_time,
    worked_minutes=DATEDIFF(MINUTE,ci.check_in_time,paired.check_out_time),
    status='completed',
    updated_at=COALESCE(ci.updated_at,SYSDATETIME())
FROM dbo.attendance_logs ci
CROSS APPLY (
    SELECT TOP 1 co.attendance_time AS check_out_time
    FROM dbo.attendance_logs co
    WHERE co.employee_id=ci.employee_id AND co.attendance_type='check_out'
      AND co.attendance_time>ci.check_in_time
      AND co.attendance_time<DATEADD(day,1,CAST(ci.check_in_time AS date))
      AND NOT EXISTS(
          SELECT 1 FROM dbo.attendance_logs newer
          WHERE newer.employee_id=ci.employee_id AND newer.attendance_type='check_in'
            AND newer.attendance_time>ci.check_in_time AND newer.attendance_time<co.attendance_time
      )
    ORDER BY co.attendance_time
) paired
WHERE ci.attendance_type='check_in' AND ci.check_in_time IS NOT NULL AND ci.check_out_time IS NULL;
GO

IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_attendance_logs_branch')
    ALTER TABLE dbo.attendance_logs ADD CONSTRAINT FK_attendance_logs_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id);
GO

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_attendance_schedule_session' AND object_id=OBJECT_ID('dbo.attendance_logs'))
    CREATE UNIQUE INDEX UX_attendance_schedule_session ON dbo.attendance_logs(schedule_id)
    WHERE schedule_id IS NOT NULL AND check_in_time IS NOT NULL;
GO

