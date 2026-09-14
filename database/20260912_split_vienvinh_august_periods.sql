SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @BranchId INT=(SELECT id FROM dbo.branches WHERE branch_code='GVV');
  DECLARE @AdminId INT=(SELECT TOP 1 u.id FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE r.role_code='admin' AND u.status='active' ORDER BY u.id);
  IF @BranchId IS NULL OR @AdminId IS NULL THROW 51000,N'Thiếu chi nhánh Viễn Vĩnh hoặc tài khoản admin.',1;

  /* Lưu trữ đợt gộp tháng do bộ nhập tạo; giữ nguyên dữ liệu để có thể khôi phục. */
  UPDATE dbo.schedule_registration_periods SET status='cancelled',note=N'Đã lưu trữ sau khi tách thành các đợt tuần tháng 08/2026',updated_at=SYSDATETIME()
  WHERE branch_id=@BranchId AND week_start_date='2026-08-01' AND week_end_date='2026-08-31' AND status='published';

  DECLARE @Weeks TABLE(startDate DATE PRIMARY KEY,endDate DATE,title NVARCHAR(200));
  INSERT @Weeks VALUES
    ('2026-07-27','2026-08-02',N'Lịch làm Viễn Vĩnh tuần 27/07 - 02/08/2026'),
    ('2026-08-03','2026-08-09',N'Lịch làm Viễn Vĩnh tuần 03/08 - 09/08/2026'),
    ('2026-08-10','2026-08-16',N'Lịch làm Viễn Vĩnh tuần 10/08 - 16/08/2026'),
    ('2026-08-17','2026-08-23',N'Lịch làm Viễn Vĩnh tuần 17/08 - 23/08/2026'),
    ('2026-08-24','2026-08-30',N'Lịch làm Viễn Vĩnh tuần 24/08 - 30/08/2026'),
    ('2026-08-31','2026-09-06',N'Lịch làm Viễn Vĩnh tuần 31/08 - 06/09/2026');

  MERGE dbo.schedule_registration_periods target
  USING(SELECT @BranchId branchId,startDate,endDate,title FROM @Weeks) source
  ON target.branch_id=source.branchId AND target.week_start_date=source.startDate
  WHEN MATCHED THEN UPDATE SET title=source.title,week_end_date=source.endDate,status='published',is_test=0,
    registration_open_at=DATEADD(DAY,-7,CAST(source.startDate AS datetime2)),registration_close_at=DATEADD(SECOND,-1,CAST(source.startDate AS datetime2)),
    note=N'Dữ liệu lịch thực tế tháng 08/2026',published_by=@AdminId,published_at=COALESCE(target.published_at,SYSDATETIME()),updated_at=SYSDATETIME()
  WHEN NOT MATCHED THEN INSERT(branch_id,title,week_start_date,week_end_date,registration_open_at,registration_close_at,status,is_test,created_by,note,published_by,published_at)
    VALUES(source.branchId,source.title,source.startDate,source.endDate,DATEADD(DAY,-7,CAST(source.startDate AS datetime2)),DATEADD(SECOND,-1,CAST(source.startDate AS datetime2)),
      'published',0,@AdminId,N'Dữ liệu lịch thực tế tháng 08/2026',@AdminId,SYSDATETIME());

  DECLARE @PeriodId INT,@Start DATE,@End DATE;
  DECLARE periods CURSOR LOCAL FAST_FORWARD FOR
    SELECT p.id,w.startDate,w.endDate FROM @Weeks w JOIN dbo.schedule_registration_periods p ON p.branch_id=@BranchId AND p.week_start_date=w.startDate;
  OPEN periods;FETCH NEXT FROM periods INTO @PeriodId,@Start,@End;
  WHILE @@FETCH_STATUS=0
  BEGIN
    ;WITH Dates AS(
      SELECT CASE WHEN @Start<'2026-08-01' THEN CAST('2026-08-01' AS date) ELSE @Start END workDate
      UNION ALL SELECT DATEADD(DAY,1,workDate) FROM Dates WHERE workDate<CASE WHEN @End>'2026-08-31' THEN CAST('2026-08-31' AS date) ELSE @End END
    ), Roster AS(
      SELECT DISTINCT e.id employeeId FROM dbo.employees e
      WHERE e.employee_code IN('GVV001','GVV002','GVV003','GVV004','GVV005','GVV006','GVV007','GVV008','GVV009','GVV0010','GSM002','NV001','NV002')
        AND (e.branch_id=@BranchId OR EXISTS(SELECT 1 FROM dbo.employee_schedules x WHERE x.employee_id=e.id AND x.branch_id=@BranchId AND x.work_date BETWEEN @Start AND @End AND ISNULL(x.is_test,0)=0))
    )
    MERGE dbo.employee_shift_registrations target
    USING(SELECT @PeriodId periodId,r.employeeId,d.workDate,es.shift_id shiftId,
      CASE WHEN es.id IS NULL THEN 'OFF'
        WHEN CONVERT(char(5),es.start_time_override,108)='08:00' AND CONVERT(char(5),es.end_time_override,108)='16:00' THEN 'A'
        WHEN CONVERT(char(5),es.start_time_override,108)='16:00' AND CONVERT(char(5),es.end_time_override,108)='23:00' THEN 'B'
        WHEN CONVERT(char(5),es.start_time_override,108)='08:00' AND CONVERT(char(5),es.end_time_override,108)='12:00' THEN 'P1'
        WHEN CONVERT(char(5),es.start_time_override,108)='12:00' AND CONVERT(char(5),es.end_time_override,108)='17:00' THEN 'P2'
        WHEN CONVERT(char(5),es.start_time_override,108)='17:00' AND CONVERT(char(5),es.end_time_override,108)='23:00' THEN 'P3'
        WHEN DATEDIFF(MINUTE,es.start_time_override,es.end_time_override)>=600 THEN 'FULL'
        WHEN es.start_time_override<'12:00' THEN 'A' ELSE 'B' END selectionCode
      FROM Roster r CROSS JOIN Dates d
      OUTER APPLY(SELECT TOP 1 x.* FROM dbo.employee_schedules x WHERE x.employee_id=r.employeeId AND x.branch_id=@BranchId AND x.work_date=d.workDate AND ISNULL(x.is_test,0)=0 ORDER BY x.id DESC) es
    ) source ON target.period_id=source.periodId AND target.employee_id=source.employeeId AND target.work_date=source.workDate
    WHEN MATCHED THEN UPDATE SET shift_id=source.shiftId,selection_code=source.selectionCode,preference_level='available',note=N'Đăng ký được khôi phục từ lịch thực tế tháng 08/2026',updated_at=SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT(period_id,employee_id,work_date,shift_id,selection_code,preference_level,note)
      VALUES(source.periodId,source.employeeId,source.workDate,source.shiftId,source.selectionCode,'available',N'Đăng ký được khôi phục từ lịch thực tế tháng 08/2026');
    FETCH NEXT FROM periods INTO @PeriodId,@Start,@End;
  END;
  CLOSE periods;DEALLOCATE periods;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
