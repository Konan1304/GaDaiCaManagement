IF OBJECT_ID('dbo.shift_inventory_sessions','U') IS NULL
BEGIN
 CREATE TABLE dbo.shift_inventory_sessions(
  id BIGINT IDENTITY PRIMARY KEY,
  branch_id INT NOT NULL,
  shift_session_id INT NULL,
  previous_inventory_session_id BIGINT NULL,
  business_date DATE NOT NULL,
  operation_shift_code VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL CONSTRAINT DF_sis_status DEFAULT 'RECEIVING',
  received_by_employee_id INT NULL,
  closed_by_employee_id INT NULL,
  created_by_user_id INT NOT NULL,
  received_at DATETIME2 NULL, closed_at DATETIME2 NULL,
  note NVARCHAR(1000) NULL,
  is_test BIT NOT NULL CONSTRAINT DF_sis_test DEFAULT 0,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_sis_created DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL CONSTRAINT DF_sis_updated DEFAULT SYSDATETIME(),
  CONSTRAINT FK_sis_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
  CONSTRAINT FK_sis_shift FOREIGN KEY(shift_session_id) REFERENCES dbo.shift_sessions(id),
  CONSTRAINT FK_sis_previous FOREIGN KEY(previous_inventory_session_id) REFERENCES dbo.shift_inventory_sessions(id),
  CONSTRAINT FK_sis_receiver FOREIGN KEY(received_by_employee_id) REFERENCES dbo.employees(id),
  CONSTRAINT FK_sis_closer FOREIGN KEY(closed_by_employee_id) REFERENCES dbo.employees(id),
  CONSTRAINT FK_sis_user FOREIGN KEY(created_by_user_id) REFERENCES dbo.users(id),
  CONSTRAINT CK_sis_operation CHECK(operation_shift_code IN('baseline','morning','evening')),
  CONSTRAINT CK_sis_status CHECK(status IN('RECEIVING','IN_PROGRESS','WAITING_HANDOVER','CLOSED'))
 );
 CREATE UNIQUE INDEX UX_sis_shift ON dbo.shift_inventory_sessions(shift_session_id) WHERE shift_session_id IS NOT NULL;
 CREATE INDEX IX_sis_handover ON dbo.shift_inventory_sessions(branch_id,status,business_date);
END
ELSE
BEGIN
 IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_sis_test') ALTER TABLE dbo.shift_inventory_sessions DROP CONSTRAINT CK_sis_test;
END
GO

IF OBJECT_ID('dbo.shift_inventory_items','U') IS NULL
BEGIN
 CREATE TABLE dbo.shift_inventory_items(
  id BIGINT IDENTITY PRIMARY KEY, session_id BIGINT NOT NULL, product_id INT NOT NULL, unit_id INT NOT NULL,
  opening_actual_quantity DECIMAL(18,3) NULL, declared_handover_quantity DECIMAL(18,3) NULL,
  actual_received_quantity DECIMAL(18,3) NULL, receiving_difference_quantity DECIMAL(18,3) NULL,
  imported_quantity_in_shift DECIMAL(18,3) NOT NULL CONSTRAINT DF_sii_import DEFAULT 0,
  special_export_quantity_in_shift DECIMAL(18,3) NOT NULL CONSTRAINT DF_sii_export DEFAULT 0,
  adjustment_in_quantity DECIMAL(18,3) NOT NULL CONSTRAINT DF_sii_adjin DEFAULT 0,
  adjustment_out_quantity DECIMAL(18,3) NOT NULL CONSTRAINT DF_sii_adjout DEFAULT 0,
  closing_actual_quantity DECIMAL(18,3) NULL, estimated_used_quantity DECIMAL(18,3) NULL,
  receiving_note NVARCHAR(500) NULL, closing_note NVARCHAR(500) NULL,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_sii_created DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL CONSTRAINT DF_sii_updated DEFAULT SYSDATETIME(),
  CONSTRAINT FK_sii_session FOREIGN KEY(session_id) REFERENCES dbo.shift_inventory_sessions(id) ON DELETE CASCADE,
  CONSTRAINT FK_sii_product FOREIGN KEY(product_id) REFERENCES dbo.products(id),
  CONSTRAINT FK_sii_unit FOREIGN KEY(unit_id) REFERENCES dbo.units(id),
  CONSTRAINT UQ_sii_session_product UNIQUE(session_id,product_id)
 );
END
GO

IF OBJECT_ID('dbo.inventory_discrepancies','U') IS NULL
BEGIN
 CREATE TABLE dbo.inventory_discrepancies(
  id BIGINT IDENTITY PRIMARY KEY, source_session_id BIGINT NOT NULL, receiving_session_id BIGINT NOT NULL,
  branch_id INT NOT NULL, product_id INT NOT NULL, declared_quantity DECIMAL(18,3) NOT NULL,
  actual_quantity DECIMAL(18,3) NOT NULL, difference_quantity DECIMAL(18,3) NOT NULL,
  detected_by_employee_id INT NOT NULL, status VARCHAR(12) NOT NULL CONSTRAINT DF_id_status DEFAULT 'PENDING',
  resolution_action VARCHAR(20) NULL, resolution_note NVARCHAR(1000) NULL, resolved_by_user_id INT NULL,
  resolved_at DATETIME2 NULL, adjustment_transaction_id BIGINT NULL, is_test BIT NOT NULL CONSTRAINT DF_id_test DEFAULT 0,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_id_created DEFAULT SYSDATETIME(), updated_at DATETIME2 NOT NULL CONSTRAINT DF_id_updated DEFAULT SYSDATETIME(),
  CONSTRAINT FK_id_source FOREIGN KEY(source_session_id) REFERENCES dbo.shift_inventory_sessions(id),
  CONSTRAINT FK_id_receiving FOREIGN KEY(receiving_session_id) REFERENCES dbo.shift_inventory_sessions(id),
  CONSTRAINT FK_id_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id), CONSTRAINT FK_id_product FOREIGN KEY(product_id) REFERENCES dbo.products(id),
  CONSTRAINT FK_id_employee FOREIGN KEY(detected_by_employee_id) REFERENCES dbo.employees(id), CONSTRAINT FK_id_user FOREIGN KEY(resolved_by_user_id) REFERENCES dbo.users(id),
  CONSTRAINT FK_id_transaction FOREIGN KEY(adjustment_transaction_id) REFERENCES dbo.inventory_transactions(id),
  CONSTRAINT CK_id_status CHECK(status IN('PENDING','RESOLVED')), CONSTRAINT CK_id_action CHECK(resolution_action IS NULL OR resolution_action IN('adjustment_in','adjustment_out','no_adjustment'))
 );
 CREATE INDEX IX_id_pending ON dbo.inventory_discrepancies(branch_id,status,created_at);
END
ELSE
BEGIN
 IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_id_test') ALTER TABLE dbo.inventory_discrepancies DROP CONSTRAINT CK_id_test;
END
GO

IF OBJECT_ID('dbo.shift_inventory_audit_logs','U') IS NULL
BEGIN
 CREATE TABLE dbo.shift_inventory_audit_logs(
  id BIGINT IDENTITY PRIMARY KEY, inventory_session_id BIGINT NULL, discrepancy_id BIGINT NULL, branch_id INT NOT NULL,
  actor_user_id INT NOT NULL, action VARCHAR(60) NOT NULL, payload_json NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_sial_created DEFAULT SYSDATETIME(), is_test BIT NOT NULL CONSTRAINT DF_sial_test DEFAULT 0,
  CONSTRAINT FK_sial_session FOREIGN KEY(inventory_session_id) REFERENCES dbo.shift_inventory_sessions(id),
  CONSTRAINT FK_sial_discrepancy FOREIGN KEY(discrepancy_id) REFERENCES dbo.inventory_discrepancies(id),
  CONSTRAINT FK_sial_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id), CONSTRAINT FK_sial_user FOREIGN KEY(actor_user_id) REFERENCES dbo.users(id)
 );
END
ELSE
BEGIN
 IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_sial_test') ALTER TABLE dbo.shift_inventory_audit_logs DROP CONSTRAINT CK_sial_test;
END
GO

/* Đảm bảo kênh chat mặc định tồn tại cho các chi nhánh trên Production */
IF OBJECT_ID('dbo.chat_channels','U') IS NOT NULL
BEGIN
  INSERT INTO dbo.chat_channels(branch_id, channel_type, name, is_system, is_active, is_test)
  SELECT b.id, 'SHIFT_HANDOVER', N'Bàn giao ca - ' + b.branch_name, 1, 1, 0
  FROM dbo.branches b
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.chat_channels c WHERE c.branch_id = b.id AND c.channel_type = 'SHIFT_HANDOVER'
  );
END
GO
