SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

/* Sửa dữ liệu mô phỏng để danh mục và tồn cuối khớp Tổng kho của từng chi nhánh. */
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @GeneratedSessions TABLE(
    inventorySessionId BIGINT PRIMARY KEY,branchId INT,shiftSessionId INT,
    businessDate DATE,operationShift VARCHAR(10),closedAt DATETIME2
  );
  INSERT @GeneratedSessions
  SELECT id,branch_id,shift_session_id,business_date,operation_shift_code,closed_at
  FROM dbo.shift_inventory_sessions
  WHERE is_test=0 AND note LIKE N'Dữ liệu mô phỏng từ sổ kiểm kho và doanh thu tháng 08/2026%';

  IF (SELECT COUNT(*) FROM @GeneratedSessions)<>120
    THROW 53000,N'Không tìm đủ 120 phiên kiểm kho mô phỏng cần đối chiếu.',1;

  DECLARE @Usage TABLE(
    inventorySessionId BIGINT,branchId INT,productId INT,unitId INT,
    usedQuantity DECIMAL(18,3),closingAt DATETIME2,
    PRIMARY KEY(inventorySessionId,productId)
  );

  INSERT @Usage
  SELECT gs.inventorySessionId,gs.branchId,p.id,p.unit_id,
    ROUND(r.order_count*CASE
      WHEN p.product_code IN('94012221','94012215','94012217') THEN 0.250
      WHEN p.product_code='IMP_MA_DUI_GA_LAM_SACH_RUT_XUONG_DA_TAM_UO' THEN 0.120
      WHEN p.product_code='IMP_THIT_GA_TOK' THEN 0.040
      WHEN p.product_code='91070021' THEN 0.010
      WHEN p.product_code='91010006' THEN 0.004
      WHEN p.product_code='90000606' THEN 0.003
      WHEN p.product_code='IMP_DAU_THUC_VAT_CAI_LAN' THEN 0.004
      ELSE 0.002 END,3),gs.closedAt
  FROM @GeneratedSessions gs
  JOIN dbo.shift_closing_reports r ON r.shift_session_id=gs.shiftSessionId AND r.is_test=0
  JOIN dbo.branch_inventories bi ON bi.branch_id=gs.branchId
  JOIN dbo.products p ON p.id=bi.product_id AND p.status='active'
  WHERE bi.quantity>0;

  /* Đây đều là dòng do script mô phỏng tạo; thay lại hoàn toàn bằng danh mục Tổng kho. */
  DELETE i
  FROM dbo.shift_inventory_items i JOIN @GeneratedSessions gs ON gs.inventorySessionId=i.session_id;

  DECLARE @Stock TABLE(branchId INT,productId INT,quantity DECIMAL(18,3),PRIMARY KEY(branchId,productId));
  INSERT @Stock
  SELECT bi.branch_id,bi.product_id,bi.quantity+SUM(u.usedQuantity)
  FROM dbo.branch_inventories bi JOIN @Usage u ON u.branchId=bi.branch_id AND u.productId=bi.product_id
  GROUP BY bi.branch_id,bi.product_id,bi.quantity;

  DECLARE @SessionId BIGINT,@BranchId INT,@ClosedAt DATETIME2,@ProductId INT,@UnitId INT,
    @Used DECIMAL(18,3),@Opening DECIMAL(18,3),@Closing DECIMAL(18,3);
  DECLARE sessions CURSOR LOCAL FAST_FORWARD FOR
    SELECT inventorySessionId,branchId,closedAt FROM @GeneratedSessions
    ORDER BY branchId,businessDate,CASE operationShift WHEN 'morning' THEN 0 ELSE 1 END;
  OPEN sessions;
  FETCH NEXT FROM sessions INTO @SessionId,@BranchId,@ClosedAt;
  WHILE @@FETCH_STATUS=0
  BEGIN
    DECLARE items CURSOR LOCAL FAST_FORWARD FOR
      SELECT u.productId,u.unitId,u.usedQuantity,s.quantity
      FROM @Usage u JOIN @Stock s ON s.branchId=u.branchId AND s.productId=u.productId
      WHERE u.inventorySessionId=@SessionId ORDER BY u.productId;
    OPEN items;
    FETCH NEXT FROM items INTO @ProductId,@UnitId,@Used,@Opening;
    WHILE @@FETCH_STATUS=0
    BEGIN
      SET @Closing=ROUND(@Opening-@Used,3);
      INSERT dbo.shift_inventory_items(session_id,product_id,unit_id,opening_actual_quantity,
        declared_handover_quantity,actual_received_quantity,receiving_difference_quantity,
        imported_quantity_in_shift,special_export_quantity_in_shift,adjustment_in_quantity,
        adjustment_out_quantity,closing_actual_quantity,estimated_used_quantity,closing_note,
        created_at,updated_at)
      VALUES(@SessionId,@ProductId,@UnitId,@Opening,@Opening,@Opening,0,0,@Used,0,0,@Closing,@Used,
        N'Dữ liệu mô phỏng theo doanh thu; đã đối chiếu với Tổng kho chi nhánh.',DATEADD(HOUR,-8,@ClosedAt),@ClosedAt);
      UPDATE @Stock SET quantity=@Closing WHERE branchId=@BranchId AND productId=@ProductId;
      FETCH NEXT FROM items INTO @ProductId,@UnitId,@Used,@Opening;
    END;
    CLOSE items; DEALLOCATE items;
    UPDATE dbo.shift_inventory_sessions
      SET note=N'Dữ liệu mô phỏng theo doanh thu tháng 08/2026; danh mục và tồn cuối đã đối chiếu Tổng kho.',updated_at=@ClosedAt
    WHERE id=@SessionId;
    FETCH NEXT FROM sessions INTO @SessionId,@BranchId,@ClosedAt;
  END;
  CLOSE sessions; DEALLOCATE sessions;

  IF EXISTS(
    SELECT 1 FROM @Stock s JOIN dbo.branch_inventories bi ON bi.branch_id=s.branchId AND bi.product_id=s.productId
    WHERE ABS(s.quantity-bi.quantity)>0.001
  ) THROW 53001,N'Tồn cuối mô phỏng chưa khớp Tổng kho.',1;

  IF EXISTS(
    SELECT 1 FROM dbo.shift_inventory_items i JOIN @GeneratedSessions gs ON gs.inventorySessionId=i.session_id
    LEFT JOIN dbo.branch_inventories bi ON bi.branch_id=gs.branchId AND bi.product_id=i.product_id
    WHERE bi.product_id IS NULL OR bi.quantity<=0
  ) THROW 53002,N'Sổ kiểm kho còn sản phẩm không thuộc Tổng kho chi nhánh.',1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF CURSOR_STATUS('local','items')>=0 CLOSE items;
  IF CURSOR_STATUS('local','items')>-3 DEALLOCATE items;
  IF CURSOR_STATUS('local','sessions')>=0 CLOSE sessions;
  IF CURSOR_STATUS('local','sessions')>-3 DEALLOCATE sessions;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
