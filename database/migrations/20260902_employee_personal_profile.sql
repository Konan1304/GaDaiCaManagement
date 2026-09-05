IF COL_LENGTH('dbo.employees','identity_number') IS NULL ALTER TABLE dbo.employees ADD identity_number VARCHAR(20) NULL;
IF COL_LENGTH('dbo.employees','identity_issue_date') IS NULL ALTER TABLE dbo.employees ADD identity_issue_date DATE NULL;
IF COL_LENGTH('dbo.employees','identity_issue_place') IS NULL ALTER TABLE dbo.employees ADD identity_issue_place NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.employees','bank_account_number') IS NULL ALTER TABLE dbo.employees ADD bank_account_number VARCHAR(50) NULL;
IF COL_LENGTH('dbo.employees','bank_name') IS NULL ALTER TABLE dbo.employees ADD bank_name NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.employees','bank_branch') IS NULL ALTER TABLE dbo.employees ADD bank_branch NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.employees','profile_submitted_at') IS NULL ALTER TABLE dbo.employees ADD profile_submitted_at DATETIME2 NULL;
GO
