SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

/*
  Phan bo bao cao sale tong hop thang 08/2026 thanh bao cao tung ngay.
  Nguon: bang "BAO CAO SALE CUNG KY" do nguoi dung cung cap.

  Quy doi kenh trong he thong:
    TAKEAWAY  -> cash_revenue
    ATM       -> mpos_revenue
    GRAB      -> grab_revenue
    SHOPEEFOOD-> shopeefood_revenue
    BE        -> be_revenue
    XANH      -> xanh_sm_revenue

  Du lieu nguon chi co tong 30 ngay, khong co chi phi/chot quy tung ngay.
  Vi vay cash_expense va difference_amount duoc de bang 0.
*/

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @AdminId INT=(
    SELECT TOP (1) u.id
    FROM dbo.users u
    JOIN dbo.roles r ON r.id=u.role_id
    WHERE r.role_code='admin' AND u.status='active'
    ORDER BY u.id
  );
  IF @AdminId IS NULL THROW 51000,N'Không tìm thấy tài khoản admin đang hoạt động.',1;

  DECLARE @Source TABLE(
    branchCode VARCHAR(20) PRIMARY KEY,
    totalRevenue BIGINT NOT NULL,
    orderCount INT NOT NULL,
    cashRevenue BIGINT NOT NULL,
    grabRevenue BIGINT NOT NULL,
    shopeeRevenue BIGINT NOT NULL,
    beRevenue BIGINT NOT NULL,
    mposRevenue BIGINT NOT NULL,
    xanhRevenue BIGINT NOT NULL
  );

  INSERT @Source VALUES
    ('CN001',167667752,1822,19545000,86268000,35385002,5706250,16390000,4373500),
    ('GVV',   63557000, 727,17860000,23657000,11725000, 475000, 9600000, 240000);

  IF EXISTS(
    SELECT 1 FROM @Source s
    WHERE s.totalRevenue<>(s.cashRevenue+s.grabRevenue+s.shopeeRevenue+s.beRevenue+s.mposRevenue+s.xanhRevenue)
  ) THROW 51001,N'Tổng các kênh không khớp tổng doanh thu nguồn.',1;

  IF EXISTS(SELECT 1 FROM @Source s LEFT JOIN dbo.branches b ON b.branch_code=s.branchCode WHERE b.id IS NULL)
    THROW 51002,N'Không tìm thấy chi nhánh cần nhập.',1;

  DECLARE @Days TABLE(dayNo INT PRIMARY KEY,businessDate DATE,weightValue INT,cumulativeWeight INT);
  ;WITH D AS(
    SELECT 1 dayNo,CAST('2026-08-01' AS DATE) businessDate
    UNION ALL
    SELECT dayNo+1,DATEADD(DAY,1,businessDate) FROM D WHERE dayNo<30
  ), W AS(
    SELECT dayNo,businessDate,
      90+((dayNo*37)%21)+CASE WHEN DATEDIFF(DAY,'19000101',businessDate)%7 IN(5,6) THEN 18 ELSE 0 END weightValue
    FROM D
  )
  INSERT @Days
  SELECT dayNo,businessDate,weightValue,SUM(weightValue) OVER(ORDER BY dayNo ROWS UNBOUNDED PRECEDING)
  FROM W OPTION(MAXRECURSION 31);

  DECLARE @TotalWeight INT=(SELECT MAX(cumulativeWeight) FROM @Days);
  DECLARE @Daily TABLE(
    branchCode VARCHAR(20),businessDate DATE,
    totalRevenue BIGINT,orderCount INT,cashRevenue BIGINT,grabRevenue BIGINT,
    shopeeRevenue BIGINT,beRevenue BIGINT,mposRevenue BIGINT,xanhRevenue BIGINT,
    PRIMARY KEY(branchCode,businessDate)
  );

  INSERT @Daily
  SELECT s.branchCode,d.businessDate,
    FLOOR(1.0*s.totalRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.totalRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.orderCount*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.orderCount*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.cashRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.cashRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.grabRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.grabRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.shopeeRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.shopeeRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.beRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.beRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.mposRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.mposRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight),
    FLOOR(1.0*s.xanhRevenue*d.cumulativeWeight/@TotalWeight)-FLOOR(1.0*s.xanhRevenue*(d.cumulativeWeight-d.weightValue)/@TotalWeight)
  FROM @Source s CROSS JOIN @Days d;

  DECLARE @DailyShift TABLE(
    branchCode VARCHAR(20),businessDate DATE,operationShift VARCHAR(10),
    totalRevenue BIGINT,orderCount INT,cashRevenue BIGINT,grabRevenue BIGINT,
    shopeeRevenue BIGINT,beRevenue BIGINT,mposRevenue BIGINT,xanhRevenue BIGINT,
    PRIMARY KEY(branchCode,businessDate,operationShift)
  );
  /* 42% doanh thu cho ca sáng, phần còn lại cho ca tối; phép trừ giữ tổng khớp tuyệt đối. */
  INSERT @DailyShift
  SELECT branchCode,businessDate,v.operationShift,
    CASE WHEN v.operationShift='morning' THEN FLOOR(totalRevenue*0.42) ELSE totalRevenue-FLOOR(totalRevenue*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(orderCount*0.42) ELSE orderCount-FLOOR(orderCount*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(cashRevenue*0.42) ELSE cashRevenue-FLOOR(cashRevenue*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(grabRevenue*0.42) ELSE grabRevenue-FLOOR(grabRevenue*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(shopeeRevenue*0.42) ELSE shopeeRevenue-FLOOR(shopeeRevenue*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(beRevenue*0.42) ELSE beRevenue-FLOOR(beRevenue*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(mposRevenue*0.42) ELSE mposRevenue-FLOOR(mposRevenue*0.42) END,
    CASE WHEN v.operationShift='morning' THEN FLOOR(xanhRevenue*0.42) ELSE xanhRevenue-FLOOR(xanhRevenue*0.42) END
  FROM @Daily CROSS JOIN (VALUES('morning'),('evening'))v(operationShift);

  DECLARE @BranchCode VARCHAR(20),@Date DATE,@OperationShift VARCHAR(10),@Total BIGINT,@Orders INT,@Cash BIGINT,@Grab BIGINT,
          @Shopee BIGINT,@Be BIGINT,@Mpos BIGINT,@Xanh BIGINT,@BranchId INT,@EmployeeId INT,
          @ScheduleId INT,@ShiftId INT,@SessionId INT,@ActorUserId INT,@OpenedAt DATETIME2,@ClosedAt DATETIME2;

  DECLARE saleRows CURSOR LOCAL FAST_FORWARD FOR
    SELECT branchCode,businessDate,operationShift,totalRevenue,orderCount,cashRevenue,grabRevenue,
           shopeeRevenue,beRevenue,mposRevenue,xanhRevenue
    FROM @DailyShift ORDER BY branchCode,businessDate,operationShift DESC;

  OPEN saleRows;
  FETCH NEXT FROM saleRows INTO @BranchCode,@Date,@OperationShift,@Total,@Orders,@Cash,@Grab,@Shopee,@Be,@Mpos,@Xanh;
  WHILE @@FETCH_STATUS=0
  BEGIN
    SELECT @BranchId=id FROM dbo.branches WHERE branch_code=@BranchCode;
    SELECT @EmployeeId=NULL,@ScheduleId=NULL,@ShiftId=NULL;
    SELECT TOP (1) @EmployeeId=es.employee_id,@ScheduleId=es.id,@ShiftId=es.shift_id
    FROM dbo.employee_schedules es
    WHERE es.branch_id=@BranchId AND es.work_date=@Date AND ISNULL(es.is_test,0)=0
    ORDER BY CASE WHEN @OperationShift='morning' AND es.start_time_override<'12:00' THEN 0
                  WHEN @OperationShift='evening' AND es.end_time_override>='20:00' THEN 0 ELSE 1 END,es.id;
    IF @EmployeeId IS NULL THROW 51003,N'Thiếu lịch làm để gán người lập báo cáo doanh thu.',1;
    SELECT @ActorUserId=user_id FROM dbo.employees WHERE id=@EmployeeId;

    SET @OpenedAt=DATEADD(HOUR,CASE WHEN @OperationShift='morning' THEN 8 ELSE 16 END,CAST(@Date AS DATETIME2));
    SET @ClosedAt=DATEADD(HOUR,CASE WHEN @OperationShift='morning' THEN 16 ELSE 23 END,CAST(@Date AS DATETIME2));
    SET @SessionId=NULL;
    SELECT @SessionId=id FROM dbo.shift_sessions
    WHERE branch_id=@BranchId AND business_date=@Date AND operation_shift_code=@OperationShift AND is_test=0
      AND note=N'Dữ liệu phân bổ từ báo cáo sale tổng hợp tháng 08/2026';

    IF @SessionId IS NULL
    BEGIN
      IF EXISTS(SELECT 1 FROM dbo.shift_sessions WHERE branch_id=@BranchId AND business_date=@Date AND operation_shift_code=@OperationShift AND is_test=0 AND status NOT IN('cancelled','CANCELLED'))
        THROW 51004,N'Ngày nhập đã có ca thực tế; dừng để không ghi đè.',1;
      INSERT dbo.shift_sessions(branch_id,employee_id,schedule_id,shift_id,business_date,opened_at,closed_at,
        opening_cash,status,note,operation_shift_code,leader_employee_id,opened_by,report_submitted_at,handed_over_at,
        locked_at,updated_at,is_test)
      VALUES(@BranchId,@EmployeeId,@ScheduleId,@ShiftId,@Date,@OpenedAt,@ClosedAt,1000000,'LOCKED',
        N'Dữ liệu phân bổ từ báo cáo sale tổng hợp tháng 08/2026',@OperationShift,@EmployeeId,@AdminId,@ClosedAt,@ClosedAt,@ClosedAt,@ClosedAt,0);
      SET @SessionId=SCOPE_IDENTITY();
    END
    ELSE
      UPDATE dbo.shift_sessions SET employee_id=@EmployeeId,schedule_id=@ScheduleId,shift_id=@ShiftId,
        leader_employee_id=@EmployeeId,opened_by=@AdminId,opened_at=@OpenedAt,closed_at=@ClosedAt,
        report_submitted_at=@ClosedAt,handed_over_at=@ClosedAt,locked_at=@ClosedAt,updated_at=SYSDATETIME()
      WHERE id=@SessionId;

    IF EXISTS(SELECT 1 FROM dbo.shift_closing_reports WHERE shift_session_id=@SessionId AND is_test=0)
      UPDATE dbo.shift_closing_reports SET employee_id=@EmployeeId,business_date=@Date,opening_cash=1000000,
        cash_revenue=@Cash,transfer_revenue=@Mpos,ewallet_revenue=0,
        delivery_revenue=@Grab+@Shopee+@Be+@Xanh,total_revenue=@Total,total_expense=0,
        expected_cash=1000000+@Cash,actual_cash=1000000+@Cash,difference_amount=0,
        note=N'Dữ liệu phân bổ từ báo cáo sale tổng hợp; không phải số chốt ca gốc.',status='submitted',
        closed_at=@ClosedAt,cash_to_deposit=@Cash,submitted_at=@ClosedAt,updated_at=SYSDATETIME(),
        gross_sales=@Total,net_sales=@Total,order_count=@Orders,customer_count=@Orders,discount_amount=0,
        grab_revenue=@Grab,shopeefood_revenue=@Shopee,be_revenue=@Be,mpos_revenue=@Mpos,
        other_revenue=0,cash_expense=0,other_cash_income=0,submitted_by=@AdminId,updated_by=@AdminId,
        xanh_sm_revenue=@Xanh
      WHERE shift_session_id=@SessionId AND is_test=0;
    ELSE
      INSERT dbo.shift_closing_reports(shift_session_id,employee_id,business_date,opening_cash,cash_revenue,
        transfer_revenue,ewallet_revenue,delivery_revenue,total_revenue,total_expense,expected_cash,actual_cash,
        difference_amount,note,status,closed_at,cash_to_deposit,submitted_at,updated_at,is_test,gross_sales,
        net_sales,order_count,customer_count,discount_amount,grab_revenue,shopeefood_revenue,be_revenue,
        mpos_revenue,other_revenue,cash_expense,other_cash_income,submitted_by,updated_by,xanh_sm_revenue)
      VALUES(@SessionId,@EmployeeId,@Date,1000000,@Cash,@Mpos,0,@Grab+@Shopee+@Be+@Xanh,@Total,0,
        1000000+@Cash,1000000+@Cash,0,N'Dữ liệu phân bổ từ báo cáo sale tổng hợp; không phải số chốt ca gốc.',
        'submitted',@ClosedAt,@Cash,@ClosedAt,@ClosedAt,0,@Total,@Total,@Orders,@Orders,0,@Grab,@Shopee,
        @Be,@Mpos,0,0,0,@AdminId,@AdminId,@Xanh);

    IF NOT EXISTS(
      SELECT 1 FROM dbo.business_events
      WHERE event_type='SHIFT_REPORT_SUBMITTED' AND entity_type='shift_session' AND entity_id=@SessionId AND is_test=0
    )
      INSERT dbo.business_events(event_type,branch_id,actor_user_id,actor_employee_id,entity_type,entity_id,
        payload_json,process_status,is_test,occurred_at,processed_at)
      VALUES('SHIFT_REPORT_SUBMITTED',@BranchId,@ActorUserId,@EmployeeId,'shift_session',@SessionId,
        CONCAT(N'{"source":"august_sales_summary","operationShift":"',@OperationShift,
          N'","totalRevenue":',@Total,N'}'),'processed',0,@ClosedAt,@ClosedAt);

    FETCH NEXT FROM saleRows INTO @BranchCode,@Date,@OperationShift,@Total,@Orders,@Cash,@Grab,@Shopee,@Be,@Mpos,@Xanh;
  END;
  CLOSE saleRows;
  DEALLOCATE saleRows;

  IF EXISTS(
    SELECT 1 FROM @Source s
    JOIN (
      SELECT b.branch_code,SUM(r.total_revenue) totalRevenue,SUM(r.order_count) orderCount,
        SUM(r.cash_revenue) cashRevenue,SUM(r.grab_revenue) grabRevenue,
        SUM(r.shopeefood_revenue) shopeeRevenue,SUM(r.be_revenue) beRevenue,
        SUM(r.mpos_revenue) mposRevenue,SUM(r.xanh_sm_revenue) xanhRevenue
      FROM dbo.shift_closing_reports r
      JOIN dbo.shift_sessions ss ON ss.id=r.shift_session_id
      JOIN dbo.branches b ON b.id=ss.branch_id
      WHERE ss.business_date BETWEEN '2026-08-01' AND '2026-08-30' AND ss.is_test=0 AND r.is_test=0
        AND ss.note=N'Dữ liệu phân bổ từ báo cáo sale tổng hợp tháng 08/2026'
      GROUP BY b.branch_code
    ) x ON x.branch_code=s.branchCode
    WHERE x.totalRevenue<>s.totalRevenue OR x.orderCount<>s.orderCount OR x.cashRevenue<>s.cashRevenue
       OR x.grabRevenue<>s.grabRevenue OR x.shopeeRevenue<>s.shopeeRevenue OR x.beRevenue<>s.beRevenue
       OR x.mposRevenue<>s.mposRevenue OR x.xanhRevenue<>s.xanhRevenue
  ) THROW 51005,N'Kết quả phân bổ không khớp dữ liệu nguồn.',1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF CURSOR_STATUS('local','saleRows')>=0 CLOSE saleRows;
  IF CURSOR_STATUS('local','saleRows')>-3 DEALLOCATE saleRows;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
