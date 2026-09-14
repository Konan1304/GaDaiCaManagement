SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @EmployeeId INT=(SELECT id FROM dbo.employees WHERE employee_code='NV001');
  DECLARE @BranchId INT=(SELECT TOP 1 id FROM dbo.branches WHERE branch_code IN('CN001','GVK') ORDER BY CASE branch_code WHEN 'CN001' THEN 0 ELSE 1 END);
  DECLARE @ShiftId INT=(SELECT TOP 1 id FROM dbo.shifts WHERE shift_code='A' AND status='active' ORDER BY id);
  DECLARE @AdminId INT=(SELECT TOP 1 u.id FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE r.role_code='admin' AND u.status='active' ORDER BY u.id);
  IF @EmployeeId IS NULL OR @BranchId IS NULL OR @ShiftId IS NULL OR @AdminId IS NULL
    THROW 51000,N'Thiếu nhân viên NV001, chi nhánh Vạn Kiếp, ca A hoặc tài khoản admin.',1;

  DECLARE @ScheduleId INT=(SELECT TOP 1 id FROM dbo.employee_schedules WHERE employee_id=@EmployeeId AND work_date='2026-08-07' AND ISNULL(is_test,0)=0 ORDER BY id);
  IF @ScheduleId IS NULL
  BEGIN
    INSERT dbo.employee_schedules(employee_id,shift_id,branch_id,work_date,display_code,start_time_override,end_time_override,note,status,is_test,created_by)
    VALUES(@EmployeeId,@ShiftId,@BranchId,'2026-08-07',N'08:00-16:00','08:00','16:00',N'Nhập lịch Vạn Kiếp tuần 03/08–09/08/2026','completed',0,@AdminId);
  END
  ELSE
  BEGIN
    UPDATE dbo.employee_schedules
    SET shift_id=@ShiftId,branch_id=@BranchId,display_code=N'08:00-16:00',start_time_override='08:00',end_time_override='16:00',
        note=N'Nhập lịch Vạn Kiếp tuần 03/08–09/08/2026',status='completed',updated_at=SYSDATETIME()
    WHERE id=@ScheduleId;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
