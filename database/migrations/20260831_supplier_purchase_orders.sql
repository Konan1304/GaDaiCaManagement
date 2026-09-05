IF OBJECT_ID('dbo.supplier_purchase_orders','U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_purchase_orders(
    id INT IDENTITY PRIMARY KEY,
    order_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    branch_id INT NOT NULL,
    created_by INT NOT NULL,
    order_date DATE NOT NULL,
    note NVARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,
    CONSTRAINT FK_supplier_purchase_orders_supplier FOREIGN KEY(supplier_id) REFERENCES dbo.suppliers(id),
    CONSTRAINT FK_supplier_purchase_orders_branch FOREIGN KEY(branch_id) REFERENCES dbo.branches(id),
    CONSTRAINT FK_supplier_purchase_orders_user FOREIGN KEY(created_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_supplier_purchase_orders_status CHECK(status IN ('draft','sent','cancelled'))
  );
END;
GO
IF OBJECT_ID('dbo.supplier_purchase_order_items','U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_purchase_order_items(
    id INT IDENTITY PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(18,3) NOT NULL,
    CONSTRAINT FK_supplier_purchase_order_items_order FOREIGN KEY(purchase_order_id) REFERENCES dbo.supplier_purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT FK_supplier_purchase_order_items_product FOREIGN KEY(product_id) REFERENCES dbo.products(id),
    CONSTRAINT CK_supplier_purchase_order_items_quantity CHECK(quantity>0),
    CONSTRAINT UQ_supplier_purchase_order_product UNIQUE(purchase_order_id,product_id)
  );
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.supplier_purchase_orders') AND name='IX_supplier_purchase_orders_date')
  CREATE INDEX IX_supplier_purchase_orders_date ON dbo.supplier_purchase_orders(order_date DESC,branch_id,supplier_id);
GO
