/* Giai đoạn 2 - báo cáo cuối ca và kiểm kê quỹ. Migration dùng chung schema,
   nhưng hiện chỉ được chạy bởi quy trình migrate:sandbox. */
IF COL_LENGTH('dbo.shift_closing_reports','cash_to_deposit') IS NULL
  ALTER TABLE dbo.shift_closing_reports ADD cash_to_deposit DECIMAL(18,2) NOT NULL CONSTRAINT DF_shift_report_deposit DEFAULT 0;
IF COL_LENGTH('dbo.shift_closing_reports','submitted_at') IS NULL
  ALTER TABLE dbo.shift_closing_reports ADD submitted_at DATETIME2 NULL;
IF COL_LENGTH('dbo.shift_closing_reports','updated_at') IS NULL
  ALTER TABLE dbo.shift_closing_reports ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_shift_report_updated DEFAULT SYSDATETIME();
IF COL_LENGTH('dbo.shift_closing_reports','is_test') IS NULL
  ALTER TABLE dbo.shift_closing_reports ADD is_test BIT NOT NULL CONSTRAINT DF_shift_report_test DEFAULT 0;
GO

IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_shift_closing_reports_status')
  ALTER TABLE dbo.shift_closing_reports DROP CONSTRAINT CK_shift_closing_reports_status;
ALTER TABLE dbo.shift_closing_reports ADD CONSTRAINT CK_shift_closing_reports_status
  CHECK(status IN('draft','submitted','approved','rejected','adjusted'));
GO

IF OBJECT_ID('dbo.shift_cash_denominations','U') IS NULL
BEGIN
  CREATE TABLE dbo.shift_cash_denominations(
    id BIGINT IDENTITY PRIMARY KEY,
    shift_closing_report_id INT NOT NULL,
    denomination_value INT NOT NULL,
    quantity INT NOT NULL,
    line_total AS (CONVERT(DECIMAL(18,2),denomination_value) * quantity) PERSISTED,
    is_test BIT NOT NULL CONSTRAINT DF_shift_cash_denom_test DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_shift_cash_denom_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_shift_cash_denom_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_shift_cash_denom_report FOREIGN KEY(shift_closing_report_id) REFERENCES dbo.shift_closing_reports(id) ON DELETE CASCADE,
    CONSTRAINT CK_shift_cash_denom_value CHECK(denomination_value IN(1000,2000,5000,10000,20000,50000,100000,200000,500000)),
    CONSTRAINT CK_shift_cash_denom_quantity CHECK(quantity>=0),
    CONSTRAINT UX_shift_cash_denom UNIQUE(shift_closing_report_id,denomination_value)
  );
END;
GO
