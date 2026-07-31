/* Sandbox operation suite - additive and idempotent. */
IF COL_LENGTH('dbo.shift_closing_reports','gross_sales') IS NULL ALTER TABLE dbo.shift_closing_reports ADD gross_sales DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_gross DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','net_sales') IS NULL ALTER TABLE dbo.shift_closing_reports ADD net_sales DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_net DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','order_count') IS NULL ALTER TABLE dbo.shift_closing_reports ADD order_count INT NOT NULL CONSTRAINT DF_scr_orders DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','customer_count') IS NULL ALTER TABLE dbo.shift_closing_reports ADD customer_count INT NOT NULL CONSTRAINT DF_scr_customers DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','discount_amount') IS NULL ALTER TABLE dbo.shift_closing_reports ADD discount_amount DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_discount DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','grab_revenue') IS NULL ALTER TABLE dbo.shift_closing_reports ADD grab_revenue DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_grab DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','shopeefood_revenue') IS NULL ALTER TABLE dbo.shift_closing_reports ADD shopeefood_revenue DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_shopee DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','be_revenue') IS NULL ALTER TABLE dbo.shift_closing_reports ADD be_revenue DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_be DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','mpos_revenue') IS NULL ALTER TABLE dbo.shift_closing_reports ADD mpos_revenue DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_mpos DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','other_revenue') IS NULL ALTER TABLE dbo.shift_closing_reports ADD other_revenue DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_other DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','cash_expense') IS NULL ALTER TABLE dbo.shift_closing_reports ADD cash_expense DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_cash_exp DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','other_cash_income') IS NULL ALTER TABLE dbo.shift_closing_reports ADD other_cash_income DECIMAL(18,2) NOT NULL CONSTRAINT DF_scr_cash_income DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','submitted_by') IS NULL ALTER TABLE dbo.shift_closing_reports ADD submitted_by INT NULL;
IF COL_LENGTH('dbo.shift_closing_reports','updated_by') IS NULL ALTER TABLE dbo.shift_closing_reports ADD updated_by INT NULL;
IF COL_LENGTH('dbo.shift_closing_reports','version') IS NULL ALTER TABLE dbo.shift_closing_reports ADD version INT NOT NULL CONSTRAINT DF_scr_version DEFAULT 1;
GO
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_scr_submitted_by') ALTER TABLE dbo.shift_closing_reports ADD CONSTRAINT FK_scr_submitted_by FOREIGN KEY(submitted_by) REFERENCES dbo.users(id);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_scr_updated_by') ALTER TABLE dbo.shift_closing_reports ADD CONSTRAINT FK_scr_updated_by FOREIGN KEY(updated_by) REFERENCES dbo.users(id);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_scr_business_date' AND object_id=OBJECT_ID('dbo.shift_closing_reports')) CREATE INDEX IX_scr_business_date ON dbo.shift_closing_reports(business_date,status) INCLUDE(net_sales,cash_revenue,difference_amount,is_test);
GO

IF OBJECT_ID('dbo.shift_cash_counts','U') IS NULL
BEGIN
 CREATE TABLE dbo.shift_cash_counts(
  id BIGINT IDENTITY PRIMARY KEY,shift_session_id INT NOT NULL,denomination INT NOT NULL,quantity INT NOT NULL,
  subtotal AS (CONVERT(DECIMAL(18,2),denomination)*quantity) PERSISTED,counted_by INT NOT NULL,is_test BIT NOT NULL CONSTRAINT DF_scc_test DEFAULT 0,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_scc_created DEFAULT SYSDATETIME(),updated_at DATETIME2 NOT NULL CONSTRAINT DF_scc_updated DEFAULT SYSDATETIME(),
  CONSTRAINT FK_scc_session FOREIGN KEY(shift_session_id) REFERENCES dbo.shift_sessions(id) ON DELETE CASCADE,
  CONSTRAINT FK_scc_user FOREIGN KEY(counted_by) REFERENCES dbo.users(id),
  CONSTRAINT CK_scc_denom CHECK(denomination IN(1000,2000,5000,10000,20000,50000,100000,200000,500000)),
  CONSTRAINT CK_scc_qty CHECK(quantity>=0),CONSTRAINT UX_scc_session_denom UNIQUE(shift_session_id,denomination)
 );
END;
GO

IF OBJECT_ID('dbo.shift_report_versions','U') IS NULL
BEGIN
 CREATE TABLE dbo.shift_report_versions(id BIGINT IDENTITY PRIMARY KEY,shift_closing_report_id INT NOT NULL,version INT NOT NULL,snapshot_json NVARCHAR(MAX) NOT NULL,changed_by INT NOT NULL,reason NVARCHAR(500),created_at DATETIME2 NOT NULL CONSTRAINT DF_srv_created DEFAULT SYSDATETIME(),is_test BIT NOT NULL CONSTRAINT DF_srv_test DEFAULT 0,
 CONSTRAINT FK_srv_report FOREIGN KEY(shift_closing_report_id) REFERENCES dbo.shift_closing_reports(id),CONSTRAINT FK_srv_user FOREIGN KEY(changed_by) REFERENCES dbo.users(id),CONSTRAINT UX_srv_version UNIQUE(shift_closing_report_id,version));
END;
GO

IF OBJECT_ID('dbo.shift_handovers','U') IS NULL
BEGIN
 CREATE TABLE dbo.shift_handovers(id BIGINT IDENTITY PRIMARY KEY,from_shift_session_id INT NOT NULL,to_shift_session_id INT NULL,to_branch_id INT NOT NULL,to_business_date DATE NOT NULL,to_operation_shift_code VARCHAR(10) NOT NULL,sent_by_employee_id INT NOT NULL,received_by_employee_id INT NULL,receiver_assignment_id INT NULL,expected_opening_cash DECIMAL(18,2) NOT NULL,actual_received_cash DECIMAL(18,2) NULL,difference_amount DECIMAL(18,2) NULL,handover_note NVARCHAR(1000),receiver_note NVARCHAR(1000),status VARCHAR(12) NOT NULL CONSTRAINT DF_handover_status DEFAULT 'PENDING',sent_at DATETIME2 NOT NULL CONSTRAINT DF_handover_sent DEFAULT SYSDATETIME(),received_at DATETIME2 NULL,created_at DATETIME2 NOT NULL CONSTRAINT DF_handover_created DEFAULT SYSDATETIME(),updated_at DATETIME2 NOT NULL CONSTRAINT DF_handover_updated DEFAULT SYSDATETIME(),is_test BIT NOT NULL CONSTRAINT DF_handover_test DEFAULT 0,
 CONSTRAINT FK_handover_from FOREIGN KEY(from_shift_session_id) REFERENCES dbo.shift_sessions(id),CONSTRAINT FK_handover_to FOREIGN KEY(to_shift_session_id) REFERENCES dbo.shift_sessions(id),CONSTRAINT FK_handover_branch FOREIGN KEY(to_branch_id) REFERENCES dbo.branches(id),CONSTRAINT FK_handover_sender FOREIGN KEY(sent_by_employee_id) REFERENCES dbo.employees(id),CONSTRAINT FK_handover_receiver FOREIGN KEY(received_by_employee_id) REFERENCES dbo.employees(id),CONSTRAINT FK_handover_assignment FOREIGN KEY(receiver_assignment_id) REFERENCES dbo.operation_shift_assignments(id),CONSTRAINT CK_handover_operation CHECK(to_operation_shift_code IN('morning','evening')),CONSTRAINT CK_handover_status CHECK(status IN('PENDING','ACCEPTED','DISPUTED','CANCELLED')),CONSTRAINT UX_handover_source UNIQUE(from_shift_session_id));
 CREATE INDEX IX_handover_target ON dbo.shift_handovers(to_branch_id,to_business_date,to_operation_shift_code,status);
END;
GO

IF OBJECT_ID('dbo.operation_attachments','U') IS NULL
BEGIN
 CREATE TABLE dbo.operation_attachments(id BIGINT IDENTITY PRIMARY KEY,shift_session_id INT NOT NULL,handover_id BIGINT NULL,attachment_type VARCHAR(20) NOT NULL,original_name NVARCHAR(255) NOT NULL,stored_name VARCHAR(100) NOT NULL,mime_type VARCHAR(50) NOT NULL,file_size INT NOT NULL,relative_path NVARCHAR(500) NOT NULL,uploaded_by INT NOT NULL,is_deleted BIT NOT NULL CONSTRAINT DF_oa_deleted DEFAULT 0,deleted_by INT NULL,deleted_at DATETIME2 NULL,created_at DATETIME2 NOT NULL CONSTRAINT DF_oa_created DEFAULT SYSDATETIME(),is_test BIT NOT NULL CONSTRAINT DF_oa_test DEFAULT 0,
 CONSTRAINT FK_oa_session FOREIGN KEY(shift_session_id) REFERENCES dbo.shift_sessions(id),CONSTRAINT FK_oa_handover FOREIGN KEY(handover_id) REFERENCES dbo.shift_handovers(id),CONSTRAINT FK_oa_uploaded FOREIGN KEY(uploaded_by) REFERENCES dbo.users(id),CONSTRAINT FK_oa_deleted_by FOREIGN KEY(deleted_by) REFERENCES dbo.users(id),CONSTRAINT CK_oa_type CHECK(attachment_type IN('pos_screen','cash_count','cash','handover','confirmation','incident','other')),CONSTRAINT CK_oa_size CHECK(file_size>0 AND file_size<=5242880));
 CREATE INDEX IX_oa_session ON dbo.operation_attachments(shift_session_id,is_deleted);
END;
GO

IF OBJECT_ID('dbo.chat_channels','U') IS NULL
BEGIN
 CREATE TABLE dbo.chat_channels(id INT IDENTITY PRIMARY KEY,branch_id INT NULL,channel_type VARCHAR(20) NOT NULL,name NVARCHAR(150) NOT NULL,is_system BIT NOT NULL CONSTRAINT DF_cc_system DEFAULT 1,is_active BIT NOT NULL CONSTRAINT DF_cc_active DEFAULT 1,is_test BIT NOT NULL CONSTRAINT DF_cc_test DEFAULT 0,created_at DATETIME2 NOT NULL CONSTRAINT DF_cc_created DEFAULT SYSDATETIME(),CONSTRAINT FK_cc_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),CONSTRAINT CK_cc_type CHECK(channel_type IN('ANNOUNCEMENT','SHIFT_HANDOVER','INVENTORY','INCIDENT','GENERAL','SCHEDULE')),CONSTRAINT UX_cc_branch_type UNIQUE(branch_id,channel_type));
END;
IF OBJECT_ID('dbo.chat_messages','U') IS NULL
BEGIN
 CREATE TABLE dbo.chat_messages(id BIGINT IDENTITY PRIMARY KEY,channel_id INT NOT NULL,sender_user_id INT NULL,reply_to_id BIGINT NULL,message_type VARCHAR(10) NOT NULL CONSTRAINT DF_cm_type DEFAULT 'user',content NVARCHAR(2000) NOT NULL,business_event_id BIGINT NULL,action_url NVARCHAR(500),is_deleted BIT NOT NULL CONSTRAINT DF_cm_deleted DEFAULT 0,deleted_by INT NULL,deleted_at DATETIME2 NULL,created_at DATETIME2 NOT NULL CONSTRAINT DF_cm_created DEFAULT SYSDATETIME(),is_test BIT NOT NULL CONSTRAINT DF_cm_test DEFAULT 0,CONSTRAINT FK_cm_channel FOREIGN KEY(channel_id) REFERENCES dbo.chat_channels(id),CONSTRAINT FK_cm_sender FOREIGN KEY(sender_user_id) REFERENCES dbo.users(id),CONSTRAINT FK_cm_reply FOREIGN KEY(reply_to_id) REFERENCES dbo.chat_messages(id),CONSTRAINT FK_cm_event FOREIGN KEY(business_event_id) REFERENCES dbo.business_events(id),CONSTRAINT FK_cm_deleted_by FOREIGN KEY(deleted_by) REFERENCES dbo.users(id),CONSTRAINT CK_cm_type CHECK(message_type IN('user','system','event')));
 CREATE UNIQUE INDEX UX_cm_event ON dbo.chat_messages(business_event_id) WHERE business_event_id IS NOT NULL;
 CREATE INDEX IX_cm_channel_created ON dbo.chat_messages(channel_id,created_at DESC);
END;
IF OBJECT_ID('dbo.chat_read_states','U') IS NULL
BEGIN
 CREATE TABLE dbo.chat_read_states(channel_id INT NOT NULL,user_id INT NOT NULL,last_read_message_id BIGINT NULL,read_at DATETIME2 NOT NULL CONSTRAINT DF_crs_read DEFAULT SYSDATETIME(),CONSTRAINT PK_crs PRIMARY KEY(channel_id,user_id),CONSTRAINT FK_crs_channel FOREIGN KEY(channel_id) REFERENCES dbo.chat_channels(id),CONSTRAINT FK_crs_user FOREIGN KEY(user_id) REFERENCES dbo.users(id),CONSTRAINT FK_crs_message FOREIGN KEY(last_read_message_id) REFERENCES dbo.chat_messages(id));
END;
GO

IF COL_LENGTH('dbo.notifications','business_event_id') IS NULL ALTER TABLE dbo.notifications ADD business_event_id BIGINT NULL;
IF COL_LENGTH('dbo.notifications','chat_message_id') IS NULL ALTER TABLE dbo.notifications ADD chat_message_id BIGINT NULL;
IF COL_LENGTH('dbo.notifications','action_url') IS NULL ALTER TABLE dbo.notifications ADD action_url NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.notifications','priority') IS NULL ALTER TABLE dbo.notifications ADD priority VARCHAR(10) NOT NULL CONSTRAINT DF_notifications_priority DEFAULT 'normal';
IF COL_LENGTH('dbo.notifications','read_at') IS NULL ALTER TABLE dbo.notifications ADD read_at DATETIME2 NULL;
IF COL_LENGTH('dbo.notifications','expires_at') IS NULL ALTER TABLE dbo.notifications ADD expires_at DATETIME2 NULL;
IF COL_LENGTH('dbo.notifications','is_test') IS NULL ALTER TABLE dbo.notifications ADD is_test BIT NOT NULL CONSTRAINT DF_notifications_test DEFAULT 0;
GO
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_notifications_event') ALTER TABLE dbo.notifications ADD CONSTRAINT FK_notifications_event FOREIGN KEY(business_event_id) REFERENCES dbo.business_events(id);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_notifications_chat') ALTER TABLE dbo.notifications ADD CONSTRAINT FK_notifications_chat FOREIGN KEY(chat_message_id) REFERENCES dbo.chat_messages(id);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_notifications_user_read' AND object_id=OBJECT_ID('dbo.notifications')) CREATE INDEX IX_notifications_user_read ON dbo.notifications(user_id,is_read,created_at DESC);
GO

IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_shift_audit_action') ALTER TABLE dbo.shift_operation_audit_logs DROP CONSTRAINT CK_shift_audit_action;
ALTER TABLE dbo.shift_operation_audit_logs ADD CONSTRAINT CK_shift_audit_action CHECK(action IN('SHIFT_OPENED','SHIFT_UPDATED','REPORT_DRAFT_SAVED','REPORT_SUBMITTED','HANDOVER_ACCEPTED','HANDOVER_DISPUTED','SHIFT_LOCKED','SHIFT_UNLOCKED','SHIFT_CANCELLED'));
GO

DECLARE @branch INT,@type VARCHAR(20),@name NVARCHAR(150);
DECLARE branch_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT id FROM dbo.branches WHERE status='active';OPEN branch_cursor;FETCH NEXT FROM branch_cursor INTO @branch;
WHILE @@FETCH_STATUS=0 BEGIN
 DECLARE channel_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT t,n FROM (VALUES('ANNOUNCEMENT',N'Thông báo'),('SHIFT_HANDOVER',N'Bàn giao ca'),('INVENTORY',N'Kho'),('INCIDENT',N'Sự cố'),('GENERAL',N'Nội bộ'),('SCHEDULE',N'Lịch làm'))v(t,n);
 OPEN channel_cursor;FETCH NEXT FROM channel_cursor INTO @type,@name;WHILE @@FETCH_STATUS=0 BEGIN IF NOT EXISTS(SELECT 1 FROM dbo.chat_channels WHERE branch_id=@branch AND channel_type=@type) INSERT dbo.chat_channels(branch_id,channel_type,name,is_test) VALUES(@branch,@type,@name,1);FETCH NEXT FROM channel_cursor INTO @type,@name;END;CLOSE channel_cursor;DEALLOCATE channel_cursor;
 FETCH NEXT FROM branch_cursor INTO @branch;END;CLOSE branch_cursor;DEALLOCATE branch_cursor;
GO
