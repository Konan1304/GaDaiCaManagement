SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

/* Dữ liệu kiểm kho mô phỏng từ sổ giấy và doanh thu từng ca tháng 08/2026. */
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @Products TABLE(
    productCode VARCHAR(100) PRIMARY KEY,
    usagePerOrder DECIMAL(18,6),
    openingStock DECIMAL(18,3),
    restockQuantity DECIMAL(18,3)
  );
  INSERT @Products VALUES
    ('IMP_TUI_CHU_T',0.045000,180,35),
    ('94012222',0.110000,700,180),
    ('94012221',0.090000,600,150),
    ('94012215',0.190000,1100,260),
    ('94012216',0.130000,850,210),
    ('94012223',0.200000,1200,300),
    ('94012217',0.190000,1100,260),
    ('94012218',0.130000,850,210),
    ('91090004',0.006000,42,10),
    ('91030013',0.005000,35,8),
    ('91030014',0.005000,35,8),
    ('91030015',0.004000,30,7),
    ('92062804',0.004000,30,7),
    ('90000606',0.003000,24,6),
    ('90000001',0.004000,30,7),
    ('91010006',0.003000,24,6),
    ('90011005',0.003000,24,6);

  IF EXISTS(SELECT 1 FROM @Products x LEFT JOIN dbo.products p ON p.product_code=x.productCode WHERE p.id IS NULL)
    THROW 52000,N'Thiếu sản phẩm dùng cho dữ liệu kiểm kho.',1;

  DECLARE @Stock TABLE(branchId INT,productId INT,quantity DECIMAL(18,3),PRIMARY KEY(branchId,productId));
  INSERT @Stock
  SELECT b.id,p.id,x.openingStock
  FROM dbo.branches b CROSS JOIN @Products x JOIN dbo.products p ON p.product_code=x.productCode
  WHERE b.branch_code IN('CN001','GVV');

  DECLARE @ShiftSessionId INT,@BranchId INT,@Date DATE,@Operation VARCHAR(10),@EmployeeId INT,@UserId INT,
    @Orders INT,@Revenue DECIMAL(18,2),@InventorySessionId BIGINT,@PreviousId BIGINT,@ReceivedAt DATETIME2,@ClosedAt DATETIME2;
  DECLARE shifts CURSOR LOCAL FAST_FORWARD FOR
    SELECT ss.id,ss.branch_id,ss.business_date,ss.operation_shift_code,ss.leader_employee_id,e.user_id,
      r.order_count,r.total_revenue,
      CASE WHEN ss.operation_shift_code='morning' THEN DATEADD(HOUR,8,CAST(ss.business_date AS DATETIME2)) ELSE DATEADD(HOUR,16,CAST(ss.business_date AS DATETIME2)) END,
      CASE WHEN ss.operation_shift_code='morning' THEN DATEADD(HOUR,16,CAST(ss.business_date AS DATETIME2)) ELSE DATEADD(HOUR,23,CAST(ss.business_date AS DATETIME2)) END
    FROM dbo.shift_sessions ss
    JOIN dbo.shift_closing_reports r ON r.shift_session_id=ss.id AND r.is_test=0
    JOIN dbo.employees e ON e.id=ss.leader_employee_id
    JOIN dbo.branches b ON b.id=ss.branch_id
    WHERE b.branch_code IN('CN001','GVV') AND ss.business_date BETWEEN '2026-08-01' AND '2026-08-30'
      AND ss.is_test=0 AND ss.note=N'Dữ liệu phân bổ từ báo cáo sale tổng hợp tháng 08/2026'
    ORDER BY ss.branch_id,ss.business_date,CASE ss.operation_shift_code WHEN 'morning' THEN 0 ELSE 1 END;

  OPEN shifts;
  FETCH NEXT FROM shifts INTO @ShiftSessionId,@BranchId,@Date,@Operation,@EmployeeId,@UserId,@Orders,@Revenue,@ReceivedAt,@ClosedAt;
  WHILE @@FETCH_STATUS=0
  BEGIN
    SET @PreviousId=(SELECT TOP 1 id FROM dbo.shift_inventory_sessions
      WHERE branch_id=@BranchId AND is_test=0 AND note LIKE N'Dữ liệu mô phỏng từ sổ kiểm kho và doanh thu tháng 08/2026%'
        AND (business_date<@Date OR (business_date=@Date AND operation_shift_code='morning' AND @Operation='evening'))
      ORDER BY business_date DESC,CASE operation_shift_code WHEN 'evening' THEN 1 ELSE 0 END DESC,id DESC);

    SET @InventorySessionId=(SELECT id FROM dbo.shift_inventory_sessions WHERE shift_session_id=@ShiftSessionId);
    IF @InventorySessionId IS NULL
    BEGIN
      INSERT dbo.shift_inventory_sessions(branch_id,shift_session_id,previous_inventory_session_id,business_date,
        operation_shift_code,status,received_by_employee_id,closed_by_employee_id,created_by_user_id,
        received_at,closed_at,note,is_test,created_at,updated_at)
      VALUES(@BranchId,@ShiftSessionId,@PreviousId,@Date,@Operation,
        CASE WHEN @Date='2026-08-30' AND @Operation='evening' THEN 'WAITING_HANDOVER' ELSE 'CLOSED' END,
        @EmployeeId,@EmployeeId,@UserId,@ReceivedAt,@ClosedAt,
        N'Dữ liệu mô phỏng từ sổ kiểm kho và doanh thu tháng 08/2026; không phải số kiểm thực tế.',0,@ReceivedAt,@ClosedAt);
      SET @InventorySessionId=SCOPE_IDENTITY();
    END
    ELSE
      UPDATE dbo.shift_inventory_sessions SET previous_inventory_session_id=@PreviousId,status=CASE WHEN @Date='2026-08-30' AND @Operation='evening' THEN 'WAITING_HANDOVER' ELSE 'CLOSED' END,
        received_by_employee_id=@EmployeeId,closed_by_employee_id=@EmployeeId,created_by_user_id=@UserId,
        received_at=@ReceivedAt,closed_at=@ClosedAt,note=N'Dữ liệu mô phỏng từ sổ kiểm kho và doanh thu tháng 08/2026; không phải số kiểm thực tế.',updated_at=@ClosedAt
      WHERE id=@InventorySessionId;

    DECLARE @ProductId INT,@UnitId INT,@Rate DECIMAL(18,6),@Opening DECIMAL(18,3),@Restock DECIMAL(18,3),
      @Imported DECIMAL(18,3),@Used DECIMAL(18,3),@Closing DECIMAL(18,3);
    DECLARE products CURSOR LOCAL FAST_FORWARD FOR
      SELECT p.id,p.unit_id,x.usagePerOrder,s.quantity,x.restockQuantity
      FROM @Products x JOIN dbo.products p ON p.product_code=x.productCode
      JOIN @Stock s ON s.branchId=@BranchId AND s.productId=p.id ORDER BY p.id;
    OPEN products;
    FETCH NEXT FROM products INTO @ProductId,@UnitId,@Rate,@Opening,@Restock;
    WHILE @@FETCH_STATUS=0
    BEGIN
      SET @Imported=CASE WHEN @Operation='morning' AND DAY(@Date) IN(8,15,22,29) THEN @Restock ELSE 0 END;
      /* Hệ số doanh thu làm lượng dùng dao động nhẹ quanh mức tiêu hao theo số đơn. */
      SET @Used=ROUND(@Orders*@Rate*(0.92+((@ShiftSessionId+@ProductId)%17)/100.0),3);
      SET @Closing=@Opening+@Imported-@Used;
      IF @Closing<0 BEGIN SET @Imported=@Imported+ABS(@Closing)+@Restock; SET @Closing=@Opening+@Imported-@Used; END;

      MERGE dbo.shift_inventory_items target
      USING(SELECT @InventorySessionId sessionId,@ProductId productId) source
      ON target.session_id=source.sessionId AND target.product_id=source.productId
      WHEN MATCHED THEN UPDATE SET unit_id=@UnitId,declared_handover_quantity=@Opening,
        opening_actual_quantity=@Opening,actual_received_quantity=@Opening,receiving_difference_quantity=0,
        imported_quantity_in_shift=@Imported,special_export_quantity_in_shift=@Used,
        adjustment_in_quantity=0,adjustment_out_quantity=0,closing_actual_quantity=@Closing,
        estimated_used_quantity=@Used,receiving_note=NULL,
        closing_note=N'Số mô phỏng theo đơn hàng và doanh thu của ca.',updated_at=@ClosedAt
      WHEN NOT MATCHED THEN INSERT(session_id,product_id,unit_id,opening_actual_quantity,declared_handover_quantity,
        actual_received_quantity,receiving_difference_quantity,imported_quantity_in_shift,
        special_export_quantity_in_shift,adjustment_in_quantity,adjustment_out_quantity,
        closing_actual_quantity,estimated_used_quantity,closing_note,created_at,updated_at)
      VALUES(@InventorySessionId,@ProductId,@UnitId,@Opening,@Opening,@Opening,0,@Imported,@Used,0,0,
        @Closing,@Used,N'Số mô phỏng theo đơn hàng và doanh thu của ca.',@ReceivedAt,@ClosedAt);

      UPDATE @Stock SET quantity=@Closing WHERE branchId=@BranchId AND productId=@ProductId;
      FETCH NEXT FROM products INTO @ProductId,@UnitId,@Rate,@Opening,@Restock;
    END;
    CLOSE products; DEALLOCATE products;

    IF NOT EXISTS(SELECT 1 FROM dbo.shift_inventory_audit_logs WHERE inventory_session_id=@InventorySessionId AND action='HANDOVER_RECEIVED' AND is_test=0)
      INSERT dbo.shift_inventory_audit_logs(inventory_session_id,branch_id,actor_user_id,action,payload_json,created_at,is_test)
      VALUES(@InventorySessionId,@BranchId,@UserId,'HANDOVER_RECEIVED',N'{"source":"august_sales_inventory"}',@ReceivedAt,0);
    IF NOT EXISTS(SELECT 1 FROM dbo.shift_inventory_audit_logs WHERE inventory_session_id=@InventorySessionId AND action='SHIFT_USAGE_EXPORTED' AND is_test=0)
      INSERT dbo.shift_inventory_audit_logs(inventory_session_id,branch_id,actor_user_id,action,payload_json,created_at,is_test)
      VALUES(@InventorySessionId,@BranchId,@UserId,'SHIFT_USAGE_EXPORTED',CONCAT(N'{"source":"august_sales_inventory","orders":',@Orders,N',"revenue":',CONVERT(BIGINT,@Revenue),N'}'),DATEADD(MINUTE,-10,@ClosedAt),0);
    IF NOT EXISTS(SELECT 1 FROM dbo.shift_inventory_audit_logs WHERE inventory_session_id=@InventorySessionId AND action='INVENTORY_HANDED_OVER' AND is_test=0)
      INSERT dbo.shift_inventory_audit_logs(inventory_session_id,branch_id,actor_user_id,action,payload_json,created_at,is_test)
      VALUES(@InventorySessionId,@BranchId,@UserId,'INVENTORY_HANDED_OVER',N'{"source":"august_sales_inventory"}',@ClosedAt,0);

    FETCH NEXT FROM shifts INTO @ShiftSessionId,@BranchId,@Date,@Operation,@EmployeeId,@UserId,@Orders,@Revenue,@ReceivedAt,@ClosedAt;
  END;
  CLOSE shifts; DEALLOCATE shifts;

  IF (SELECT COUNT(*) FROM dbo.shift_inventory_sessions WHERE is_test=0 AND note LIKE N'Dữ liệu mô phỏng từ sổ kiểm kho và doanh thu tháng 08/2026%')<>120
    THROW 52001,N'Số phiên kiểm kho được tạo không đủ 120.',1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF CURSOR_STATUS('local','products')>=0 CLOSE products;
  IF CURSOR_STATUS('local','products')>-3 DEALLOCATE products;
  IF CURSOR_STATUS('local','shifts')>=0 CLOSE shifts;
  IF CURSOR_STATUS('local','shifts')>-3 DEALLOCATE shifts;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
