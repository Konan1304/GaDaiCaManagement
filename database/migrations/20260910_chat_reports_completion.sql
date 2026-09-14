IF OBJECT_ID('dbo.chat_channel_members','U') IS NULL
BEGIN
 CREATE TABLE dbo.chat_channel_members(channel_id INT NOT NULL,user_id INT NOT NULL,added_by INT NULL,added_at DATETIME2 NOT NULL CONSTRAINT DF_ccm_added DEFAULT SYSDATETIME(),CONSTRAINT PK_ccm PRIMARY KEY(channel_id,user_id),CONSTRAINT FK_ccm_channel FOREIGN KEY(channel_id) REFERENCES dbo.chat_channels(id),CONSTRAINT FK_ccm_user FOREIGN KEY(user_id) REFERENCES dbo.users(id),CONSTRAINT FK_ccm_added_by FOREIGN KEY(added_by) REFERENCES dbo.users(id));
 INSERT dbo.chat_channel_members(channel_id,user_id) SELECT c.id,e.user_id FROM dbo.chat_channels c JOIN dbo.employees e ON e.branch_id=c.branch_id AND e.status='working' WHERE c.is_system=0 AND NOT EXISTS(SELECT 1 FROM dbo.chat_channel_members m WHERE m.channel_id=c.id AND m.user_id=e.user_id);
END;
GO
IF OBJECT_ID('dbo.chat_message_attachments','U') IS NULL
BEGIN
 CREATE TABLE dbo.chat_message_attachments(id BIGINT IDENTITY PRIMARY KEY,message_id BIGINT NOT NULL,original_name NVARCHAR(255) NOT NULL,stored_name VARCHAR(120) NOT NULL,mime_type VARCHAR(100) NOT NULL,file_size INT NOT NULL,relative_path NVARCHAR(500) NOT NULL,created_at DATETIME2 NOT NULL CONSTRAINT DF_cma_created DEFAULT SYSDATETIME(),CONSTRAINT FK_cma_message FOREIGN KEY(message_id) REFERENCES dbo.chat_messages(id));
END;
GO
IF OBJECT_ID('dbo.branch_report_attachments','U') IS NULL
BEGIN
 CREATE TABLE dbo.branch_report_attachments(id BIGINT IDENTITY PRIMARY KEY,report_id BIGINT NOT NULL,original_name NVARCHAR(255) NOT NULL,stored_name VARCHAR(120) NOT NULL,mime_type VARCHAR(100) NOT NULL,file_size INT NOT NULL,relative_path NVARCHAR(500) NOT NULL,uploaded_by INT NOT NULL,created_at DATETIME2 NOT NULL CONSTRAINT DF_bra_created DEFAULT SYSDATETIME(),CONSTRAINT FK_bra_report FOREIGN KEY(report_id) REFERENCES dbo.branch_operational_reports(id),CONSTRAINT FK_bra_user FOREIGN KEY(uploaded_by) REFERENCES dbo.users(id));
END;
GO
IF OBJECT_ID('dbo.branch_report_versions','U') IS NULL
BEGIN
 CREATE TABLE dbo.branch_report_versions(id BIGINT IDENTITY PRIMARY KEY,report_id BIGINT NOT NULL,snapshot_json NVARCHAR(MAX) NOT NULL,changed_by INT NOT NULL,change_type VARCHAR(30) NOT NULL,created_at DATETIME2 NOT NULL CONSTRAINT DF_brv_created DEFAULT SYSDATETIME(),CONSTRAINT FK_brv_report FOREIGN KEY(report_id) REFERENCES dbo.branch_operational_reports(id),CONSTRAINT FK_brv_user FOREIGN KEY(changed_by) REFERENCES dbo.users(id));
END;
GO
