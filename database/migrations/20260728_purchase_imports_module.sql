SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('purchase_receipts','delivery_person') IS NULL
    ALTER TABLE purchase_receipts ADD delivery_person NVARCHAR(150) NULL;
IF COL_LENGTH('purchase_receipts','received_by') IS NULL
    ALTER TABLE purchase_receipts ADD received_by NVARCHAR(150) NULL;
IF COL_LENGTH('purchase_receipts','source_document_number') IS NULL
    ALTER TABLE purchase_receipts ADD source_document_number NVARCHAR(100) NULL;
IF COL_LENGTH('purchase_receipts','updated_at') IS NULL
    ALTER TABLE purchase_receipts ADD updated_at DATETIME2 NULL;
IF COL_LENGTH('purchase_receipts','confirmed_at') IS NULL
    ALTER TABLE purchase_receipts ADD confirmed_at DATETIME2 NULL;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_purchase_receipts_status')
    ALTER TABLE purchase_receipts DROP CONSTRAINT CK_purchase_receipts_status;
ALTER TABLE purchase_receipts WITH CHECK ADD CONSTRAINT CK_purchase_receipts_status
    CHECK (status IN ('draft','receiving','completed','adjusted','cancelled'));

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name='UQ_purchase_receipt_product')
    ALTER TABLE purchase_receipt_items DROP CONSTRAINT UQ_purchase_receipt_product;
IF COL_LENGTH('purchase_receipt_items','batch_number') IS NULL
    ALTER TABLE purchase_receipt_items ADD batch_number NVARCHAR(100) NULL;
IF COL_LENGTH('purchase_receipt_items','manufacturing_date') IS NULL
    ALTER TABLE purchase_receipt_items ADD manufacturing_date DATE NULL;
IF COL_LENGTH('purchase_receipt_items','expiry_date') IS NULL
    ALTER TABLE purchase_receipt_items ADD expiry_date DATE NULL;
IF COL_LENGTH('purchase_receipt_items','notes') IS NULL
    ALTER TABLE purchase_receipt_items ADD notes NVARCHAR(500) NULL;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('purchase_receipt_items') AND name='unit_price' AND is_nullable=0)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_purchase_receipt_items_unit_price')
        ALTER TABLE purchase_receipt_items DROP CONSTRAINT CK_purchase_receipt_items_unit_price;
    IF COL_LENGTH('purchase_receipt_items','line_total') IS NOT NULL
        ALTER TABLE purchase_receipt_items DROP COLUMN line_total;
    ALTER TABLE purchase_receipt_items ALTER COLUMN unit_price DECIMAL(18,2) NULL;
    ALTER TABLE purchase_receipt_items ADD line_total AS (quantity * unit_price) PERSISTED;
    ALTER TABLE purchase_receipt_items WITH CHECK ADD CONSTRAINT CK_purchase_receipt_items_unit_price
        CHECK (unit_price IS NULL OR unit_price >= 0);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('purchase_receipt_items') AND name='UX_purchase_receipt_product_batch')
    CREATE UNIQUE INDEX UX_purchase_receipt_product_batch
    ON purchase_receipt_items(purchase_receipt_id,product_id,batch_number);

IF COL_LENGTH('inventory_transactions','batch_number') IS NULL
    ALTER TABLE inventory_transactions ADD batch_number NVARCHAR(100) NULL;
IF COL_LENGTH('inventory_transactions','manufacturing_date') IS NULL
    ALTER TABLE inventory_transactions ADD manufacturing_date DATE NULL;
IF COL_LENGTH('inventory_transactions','expiry_date') IS NULL
    ALTER TABLE inventory_transactions ADD expiry_date DATE NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('purchase_receipts') AND name='IX_purchase_receipts_filters')
    CREATE INDEX IX_purchase_receipts_filters ON purchase_receipts(status,branch_id,supplier_id,receipt_date DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('inventory_transactions') AND name='IX_inventory_transactions_reference')
    CREATE INDEX IX_inventory_transactions_reference ON inventory_transactions(reference_type,reference_id);

COMMIT TRANSACTION;
