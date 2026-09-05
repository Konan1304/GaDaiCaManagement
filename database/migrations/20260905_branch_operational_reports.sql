IF OBJECT_ID('dbo.branch_operational_reports','U') IS NULL
BEGIN
  CREATE TABLE dbo.branch_operational_reports(
    id BIGINT IDENTITY PRIMARY KEY,
    branch_id INT NOT NULL,
    report_type VARCHAR(20) NOT NULL,
    report_date DATE NOT NULL,
    title NVARCHAR(200) NOT NULL,
    content NVARCHAR(2000) NOT NULL,
    score TINYINT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_bor_status DEFAULT 'submitted',
    created_by INT NOT NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_bor_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_bor_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_bor_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_bor_creator FOREIGN KEY(created_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_bor_reviewer FOREIGN KEY(reviewed_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_bor_type CHECK(report_type IN('HYGIENE','GOODS')),
    CONSTRAINT CK_bor_status CHECK(status IN('submitted','approved','needs_action')),
    CONSTRAINT CK_bor_score CHECK(score IS NULL OR score BETWEEN 0 AND 100)
  );
  CREATE INDEX IX_bor_branch_date ON dbo.branch_operational_reports(branch_id,report_date DESC,report_type);
END
GO

IF OBJECT_ID('dbo.chat_channels','U') IS NOT NULL
BEGIN
  DECLARE @channels TABLE(channel_type VARCHAR(20), label NVARCHAR(80));
  INSERT @channels VALUES('GENERAL',N'Trao đổi chung'),('INCIDENT',N'Báo cáo vệ sinh'),('INVENTORY',N'Báo cáo hàng hóa');
  UPDATE c SET c.name=x.label+N' - '+b.branch_name,c.is_active=1,c.is_test=0
  FROM dbo.chat_channels c JOIN dbo.branches b ON b.id=c.branch_id JOIN @channels x ON x.channel_type=c.channel_type;
  INSERT dbo.chat_channels(branch_id,channel_type,name,is_system,is_active,is_test)
  SELECT b.id,c.channel_type,c.label+N' - '+b.branch_name,1,1,0
  FROM dbo.branches b CROSS JOIN @channels c
  WHERE b.status='active' AND NOT EXISTS(SELECT 1 FROM dbo.chat_channels x WHERE x.branch_id=b.id AND x.channel_type=c.channel_type);
END
GO
