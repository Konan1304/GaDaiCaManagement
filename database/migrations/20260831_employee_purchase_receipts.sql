IF COL_LENGTH('dbo.purchase_receipts','submitted_at') IS NULL ALTER TABLE dbo.purchase_receipts ADD submitted_at DATETIME2 NULL, reviewed_at DATETIME2 NULL, reviewed_by INT NULL, review_note NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.purchase_receipt_items','ordered_quantity') IS NULL ALTER TABLE dbo.purchase_receipt_items ADD ordered_quantity DECIMAL(18,3) NULL;
GO
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_purchase_receipts_status') ALTER TABLE dbo.purchase_receipts DROP CONSTRAINT CK_purchase_receipts_status;
ALTER TABLE dbo.purchase_receipts WITH CHECK ADD CONSTRAINT CK_purchase_receipts_status CHECK(status IN ('draft','submitted','returned','rejected','completed','adjusted'));
GO
IF OBJECT_ID('dbo.purchase_receipt_documents','U') IS NULL CREATE TABLE dbo.purchase_receipt_documents(
 id BIGINT IDENTITY PRIMARY KEY,purchase_receipt_id INT NOT NULL,file_name NVARCHAR(255) NOT NULL,file_path NVARCHAR(1000) NOT NULL,mime_type VARCHAR(100) NULL,file_size BIGINT NULL,uploaded_by INT NOT NULL,created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
 CONSTRAINT FK_purchase_receipt_documents_receipt FOREIGN KEY(purchase_receipt_id) REFERENCES dbo.purchase_receipts(id) ON DELETE CASCADE,
 CONSTRAINT FK_purchase_receipt_documents_user FOREIGN KEY(uploaded_by) REFERENCES dbo.users(id));
GO
