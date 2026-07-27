IF COL_LENGTH('dbo.suppliers','display_name') IS NULL
  ALTER TABLE dbo.suppliers ADD display_name NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.suppliers','supplier_group') IS NULL
  ALTER TABLE dbo.suppliers ADD supplier_group NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.suppliers','supplied_items') IS NULL
  ALTER TABLE dbo.suppliers ADD supplied_items NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.suppliers','notes') IS NULL
  ALTER TABLE dbo.suppliers ADD notes NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.suppliers','updated_at') IS NULL
  ALTER TABLE dbo.suppliers ADD updated_at DATETIME2 NOT NULL
    CONSTRAINT DF_suppliers_updated_at DEFAULT SYSDATETIME();

IF NOT EXISTS(
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID('dbo.suppliers') AND name='UX_suppliers_tax_code_not_null'
) AND NOT EXISTS(
  SELECT tax_code FROM dbo.suppliers
  WHERE NULLIF(LTRIM(RTRIM(tax_code)),'') IS NOT NULL
  GROUP BY tax_code HAVING COUNT(*)>1
)
  CREATE UNIQUE INDEX UX_suppliers_tax_code_not_null
  ON dbo.suppliers(tax_code)
  WHERE tax_code IS NOT NULL AND tax_code<>'';
