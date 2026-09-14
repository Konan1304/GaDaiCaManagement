IF OBJECT_ID('dbo.password_reset_requests','U') IS NULL
BEGIN
  CREATE TABLE dbo.password_reset_requests(
    id BIGINT IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_prr_status DEFAULT 'pending',
    requested_ip VARCHAR(64) NULL,
    resolved_by INT NULL,
    resolved_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_prr_created DEFAULT SYSDATETIME(),
    CONSTRAINT FK_prr_user FOREIGN KEY(user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_prr_resolver FOREIGN KEY(resolved_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_prr_status CHECK(status IN('pending','resolved','cancelled'))
  );
  CREATE INDEX IX_prr_status_created ON dbo.password_reset_requests(status,created_at DESC);
END;
GO

IF OBJECT_ID('dbo.admin_audit_logs','U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_audit_logs(
    id BIGINT IDENTITY PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NULL,
    entity_id VARCHAR(80) NULL,
    details_json NVARCHAR(MAX) NULL,
    ip_address VARCHAR(64) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_aal_created DEFAULT SYSDATETIME(),
    CONSTRAINT FK_aal_user FOREIGN KEY(user_id) REFERENCES dbo.users(id)
  );
  CREATE INDEX IX_aal_created ON dbo.admin_audit_logs(created_at DESC);
END;
GO

MERGE dbo.system_settings AS target
USING (VALUES
 ('store_name',N'Gà Đại Ca',N'Tên hệ thống/cửa hàng'),
 ('support_phone',N'',N'Số điện thoại hỗ trợ'),
 ('head_office_address',N'',N'Địa chỉ văn phòng chính'),
 ('timezone',N'Asia/Ho_Chi_Minh',N'Múi giờ nghiệp vụ')
) AS source(setting_key,setting_value,description)
ON target.setting_key=source.setting_key
WHEN NOT MATCHED THEN INSERT(setting_key,setting_value,description) VALUES(source.setting_key,source.setting_value,source.description);
GO
