IF OBJECT_ID('dbo.sandbox_clock','U') IS NULL
BEGIN
  CREATE TABLE dbo.sandbox_clock(
    id TINYINT NOT NULL CONSTRAINT PK_sandbox_clock PRIMARY KEY CONSTRAINT CK_sandbox_clock_singleton CHECK(id=1),
    business_datetime DATETIME2(0) NOT NULL,
    updated_by INT NULL,
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_sandbox_clock_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_sandbox_clock_user FOREIGN KEY(updated_by) REFERENCES dbo.users(id)
  );
END;
IF NOT EXISTS(SELECT 1 FROM dbo.sandbox_clock WHERE id=1)
  INSERT dbo.sandbox_clock(id,business_datetime) VALUES(1,'2026-06-01T07:45:00');
GO

IF OBJECT_ID('dbo.operation_shift_mappings','U') IS NULL
BEGIN
  CREATE TABLE dbo.operation_shift_mappings(
    id INT IDENTITY PRIMARY KEY, branch_id INT NOT NULL, shift_id INT NOT NULL,
    operation_shift_code VARCHAR(10) NOT NULL, is_active BIT NOT NULL CONSTRAINT DF_operation_mapping_active DEFAULT 1,
    created_by INT NULL, created_at DATETIME2 NOT NULL CONSTRAINT DF_operation_mapping_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_operation_mapping_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_operation_mapping_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_operation_mapping_shift FOREIGN KEY(shift_id) REFERENCES dbo.shifts(id),
    CONSTRAINT FK_operation_mapping_user FOREIGN KEY(created_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_operation_mapping_code CHECK(operation_shift_code IN('morning','evening')),
    CONSTRAINT UX_operation_mapping UNIQUE(branch_id,shift_id)
  );
END;
GO

IF OBJECT_ID('dbo.operation_shift_assignments','U') IS NULL
BEGIN
  CREATE TABLE dbo.operation_shift_assignments(
    id INT IDENTITY PRIMARY KEY, branch_id INT NOT NULL, business_date DATE NOT NULL,
    operation_shift_code VARCHAR(10) NOT NULL, employee_id INT NOT NULL,
    assignment_role VARCHAR(10) NOT NULL, assigned_by INT NOT NULL,
    note NVARCHAR(500) NULL, status VARCHAR(12) NOT NULL CONSTRAINT DF_operation_assignment_status DEFAULT 'assigned',
    is_test BIT NOT NULL CONSTRAINT DF_operation_assignment_test DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_operation_assignment_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_operation_assignment_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_operation_assignment_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_operation_assignment_employee FOREIGN KEY(employee_id) REFERENCES dbo.employees(id),
    CONSTRAINT FK_operation_assignment_user FOREIGN KEY(assigned_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_operation_assignment_code CHECK(operation_shift_code IN('morning','evening')),
    CONSTRAINT CK_operation_assignment_role CHECK(assignment_role IN('leader','manager')),
    CONSTRAINT CK_operation_assignment_status CHECK(status IN('assigned','replaced','cancelled'))
  );
  CREATE UNIQUE INDEX UX_operation_assignment_primary ON dbo.operation_shift_assignments(branch_id,business_date,operation_shift_code) WHERE status='assigned';
END;
GO

IF COL_LENGTH('dbo.shift_sessions','operation_shift_code') IS NULL ALTER TABLE dbo.shift_sessions ADD operation_shift_code VARCHAR(10) NULL;
IF COL_LENGTH('dbo.shift_sessions','leader_employee_id') IS NULL ALTER TABLE dbo.shift_sessions ADD leader_employee_id INT NULL;
IF COL_LENGTH('dbo.shift_sessions','opened_by') IS NULL ALTER TABLE dbo.shift_sessions ADD opened_by INT NULL;
IF COL_LENGTH('dbo.shift_sessions','report_submitted_at') IS NULL ALTER TABLE dbo.shift_sessions ADD report_submitted_at DATETIME2 NULL;
IF COL_LENGTH('dbo.shift_sessions','handed_over_at') IS NULL ALTER TABLE dbo.shift_sessions ADD handed_over_at DATETIME2 NULL;
IF COL_LENGTH('dbo.shift_sessions','locked_at') IS NULL ALTER TABLE dbo.shift_sessions ADD locked_at DATETIME2 NULL;
IF COL_LENGTH('dbo.shift_sessions','unlocked_at') IS NULL ALTER TABLE dbo.shift_sessions ADD unlocked_at DATETIME2 NULL;
IF COL_LENGTH('dbo.shift_sessions','unlocked_by') IS NULL ALTER TABLE dbo.shift_sessions ADD unlocked_by INT NULL;
IF COL_LENGTH('dbo.shift_sessions','unlock_reason') IS NULL ALTER TABLE dbo.shift_sessions ADD unlock_reason NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.shift_sessions','updated_at') IS NULL ALTER TABLE dbo.shift_sessions ADD updated_at DATETIME2 NULL;
IF COL_LENGTH('dbo.shift_sessions','is_test') IS NULL ALTER TABLE dbo.shift_sessions ADD is_test BIT NOT NULL CONSTRAINT DF_shift_sessions_test DEFAULT 0;
IF COL_LENGTH('dbo.shift_sessions','row_version') IS NULL ALTER TABLE dbo.shift_sessions ADD row_version ROWVERSION;
GO
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_shift_sessions_leader') ALTER TABLE dbo.shift_sessions ADD CONSTRAINT FK_shift_sessions_leader FOREIGN KEY(leader_employee_id) REFERENCES dbo.employees(id);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_shift_sessions_opened_by') ALTER TABLE dbo.shift_sessions ADD CONSTRAINT FK_shift_sessions_opened_by FOREIGN KEY(opened_by) REFERENCES dbo.users(id);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_shift_sessions_unlocked_by') ALTER TABLE dbo.shift_sessions ADD CONSTRAINT FK_shift_sessions_unlocked_by FOREIGN KEY(unlocked_by) REFERENCES dbo.users(id);
GO
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_shift_sessions_status') ALTER TABLE dbo.shift_sessions DROP CONSTRAINT CK_shift_sessions_status;
ALTER TABLE dbo.shift_sessions ADD CONSTRAINT CK_shift_sessions_status CHECK(status IN('open','closed','cancelled','OPEN','WAITING_HANDOVER','LOCKED','REOPENED','CANCELLED'));
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_shift_sessions_operation_code') ALTER TABLE dbo.shift_sessions ADD CONSTRAINT CK_shift_sessions_operation_code CHECK(operation_shift_code IS NULL OR operation_shift_code IN('morning','evening'));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_shift_sessions_operation' AND object_id=OBJECT_ID('dbo.shift_sessions')) CREATE UNIQUE INDEX UX_shift_sessions_operation ON dbo.shift_sessions(branch_id,business_date,operation_shift_code) WHERE operation_shift_code IS NOT NULL AND status<>'cancelled' AND status<>'CANCELLED';
GO

IF OBJECT_ID('dbo.shift_operation_audit_logs','U') IS NULL
BEGIN
  CREATE TABLE dbo.shift_operation_audit_logs(
    id BIGINT IDENTITY PRIMARY KEY, shift_session_id INT NULL, branch_id INT NOT NULL,
    action VARCHAR(40) NOT NULL, old_status VARCHAR(30) NULL, new_status VARCHAR(30) NULL,
    changed_by INT NOT NULL, reason NVARCHAR(500) NULL, payload_json NVARCHAR(MAX) NULL,
    is_test BIT NOT NULL CONSTRAINT DF_shift_audit_test DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_shift_audit_created DEFAULT SYSDATETIME(),
    CONSTRAINT FK_shift_audit_session FOREIGN KEY(shift_session_id) REFERENCES dbo.shift_sessions(id),
    CONSTRAINT FK_shift_audit_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_shift_audit_user FOREIGN KEY(changed_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_shift_audit_action CHECK(action IN('SHIFT_OPENED','SHIFT_UPDATED','REPORT_SUBMITTED','HANDOVER_ACCEPTED','SHIFT_LOCKED','SHIFT_UNLOCKED','SHIFT_CANCELLED'))
  );
  CREATE INDEX IX_shift_audit_session ON dbo.shift_operation_audit_logs(shift_session_id,created_at DESC);
END;
GO

IF OBJECT_ID('dbo.business_events','U') IS NULL
BEGIN
  CREATE TABLE dbo.business_events(
    id BIGINT IDENTITY PRIMARY KEY, event_type VARCHAR(60) NOT NULL, branch_id INT NOT NULL,
    actor_user_id INT NULL, actor_employee_id INT NULL, entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL, payload_json NVARCHAR(MAX) NULL,
    process_status VARCHAR(15) NOT NULL CONSTRAINT DF_business_event_status DEFAULT 'pending',
    retry_count INT NOT NULL CONSTRAINT DF_business_event_retry DEFAULT 0, last_error NVARCHAR(1000) NULL,
    is_test BIT NOT NULL CONSTRAINT DF_business_event_test DEFAULT 0,
    occurred_at DATETIME2 NOT NULL CONSTRAINT DF_business_event_time DEFAULT SYSDATETIME(), processed_at DATETIME2 NULL,
    CONSTRAINT FK_business_event_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_business_event_user FOREIGN KEY(actor_user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_business_event_employee FOREIGN KEY(actor_employee_id) REFERENCES dbo.employees(id),
    CONSTRAINT CK_business_event_status CHECK(process_status IN('pending','processing','processed','failed'))
  );
  CREATE INDEX IX_business_event_outbox ON dbo.business_events(process_status,occurred_at);
END;
GO

MERGE dbo.system_settings AS t USING(VALUES('DEFAULT_SHIFT_OPENING_CASH',N'1000000',N'Quỹ đầu ca mặc định')) AS s(k,v,d)
ON t.setting_key=s.k WHEN MATCHED THEN UPDATE SET setting_value=s.v,description=s.d,updated_at=SYSDATETIME()
WHEN NOT MATCHED THEN INSERT(setting_key,setting_value,description) VALUES(s.k,s.v,s.d);
GO
