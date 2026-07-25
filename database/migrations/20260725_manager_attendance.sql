IF COL_LENGTH('dbo.attendance_logs','updated_by') IS NULL
    ALTER TABLE dbo.attendance_logs ADD updated_by INT NULL;
GO

IF COL_LENGTH('dbo.attendance_logs','adjustment_reason') IS NULL
    ALTER TABLE dbo.attendance_logs ADD adjustment_reason NVARCHAR(500) NULL;
GO

IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_attendance_logs_updated_by')
    ALTER TABLE dbo.attendance_logs ADD CONSTRAINT FK_attendance_logs_updated_by
        FOREIGN KEY(updated_by) REFERENCES dbo.users(id);
GO

IF NOT EXISTS(
    SELECT 1 FROM sys.indexes
    WHERE name='IX_attendance_logs_manager_filter'
      AND object_id=OBJECT_ID('dbo.attendance_logs')
)
    CREATE INDEX IX_attendance_logs_manager_filter
        ON dbo.attendance_logs(work_date,branch_id,employee_id)
        INCLUDE(schedule_id,check_in_time,check_out_time,worked_minutes,late_minutes,early_leave_minutes,is_test);
GO
