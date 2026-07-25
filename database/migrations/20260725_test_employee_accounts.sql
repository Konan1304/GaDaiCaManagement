IF COL_LENGTH('dbo.users','is_test') IS NULL
    ALTER TABLE dbo.users ADD is_test BIT NOT NULL
        CONSTRAINT DF_users_is_test DEFAULT 0;
GO
IF COL_LENGTH('dbo.users','import_tag') IS NULL
    ALTER TABLE dbo.users ADD import_tag VARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.employees','is_test') IS NULL
    ALTER TABLE dbo.employees ADD is_test BIT NOT NULL
        CONSTRAINT DF_employees_is_test DEFAULT 0;
GO
IF COL_LENGTH('dbo.employees','import_tag') IS NULL
    ALTER TABLE dbo.employees ADD import_tag VARCHAR(80) NULL;
GO
