IF OBJECT_ID(N'dbo.salary_settings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.salary_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        employee_id INT NULL,
        position_id INT NULL,
        hourly_rate DECIMAL(18,2) NOT NULL CONSTRAINT DF_salary_settings_rate DEFAULT 26000,
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT DF_salary_settings_status DEFAULT 'active',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_salary_settings_created DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_salary_settings_updated DEFAULT SYSDATETIME(),
        CONSTRAINT FK_salary_settings_employee FOREIGN KEY(employee_id) REFERENCES dbo.employees(id),
        CONSTRAINT FK_salary_settings_position FOREIGN KEY(position_id) REFERENCES dbo.positions(id),
        CONSTRAINT CK_salary_settings_target CHECK(employee_id IS NOT NULL OR position_id IS NOT NULL),
        CONSTRAINT CK_salary_settings_rate CHECK(hourly_rate >= 0),
        CONSTRAINT CK_salary_settings_dates CHECK(effective_to IS NULL OR effective_to >= effective_from),
        CONSTRAINT CK_salary_settings_status CHECK(status IN ('active','inactive'))
    );
END;
GO

IF OBJECT_ID(N'dbo.payrolls', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payrolls (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        employee_id INT NOT NULL,
        payroll_month DATE NOT NULL,
        total_work_days INT NOT NULL CONSTRAINT DF_payroll_days DEFAULT 0,
        total_work_hours DECIMAL(10,2) NOT NULL CONSTRAINT DF_payroll_hours DEFAULT 0,
        hourly_rate DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_rate DEFAULT 26000,
        base_salary DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_base DEFAULT 0,
        parking_allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_parking DEFAULT 0,
        meal_allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_meal DEFAULT 0,
        other_allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_other_allowance DEFAULT 0,
        bonus DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_bonus DEFAULT 0,
        uniform_deduction DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_uniform DEFAULT 0,
        salary_advance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_advance DEFAULT 0,
        other_deduction DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_other_deduction DEFAULT 0,
        net_salary DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_net DEFAULT 0,
        status VARCHAR(20) NOT NULL CONSTRAINT DF_payroll_status DEFAULT 'draft',
        note NVARCHAR(1000) NULL,
        created_by INT NULL,
        approved_by INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_payroll_created DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_payroll_updated DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_payroll_employee_month UNIQUE(employee_id,payroll_month),
        CONSTRAINT FK_payroll_employee FOREIGN KEY(employee_id) REFERENCES dbo.employees(id),
        CONSTRAINT FK_payroll_created_by FOREIGN KEY(created_by) REFERENCES dbo.users(id),
        CONSTRAINT FK_payroll_approved_by FOREIGN KEY(approved_by) REFERENCES dbo.users(id),
        CONSTRAINT CK_payroll_status CHECK(status IN ('draft','confirmed','paid')),
        CONSTRAINT CK_payroll_values CHECK(
            total_work_days >= 0 AND total_work_hours >= 0 AND hourly_rate >= 0 AND
            parking_allowance >= 0 AND meal_allowance >= 0 AND other_allowance >= 0 AND bonus >= 0 AND
            uniform_deduction >= 0 AND salary_advance >= 0 AND other_deduction >= 0
        )
    );
END;
GO

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IX_payrolls_month' AND object_id=OBJECT_ID(N'dbo.payrolls'))
    CREATE INDEX IX_payrolls_month ON dbo.payrolls(payroll_month,employee_id);
GO

