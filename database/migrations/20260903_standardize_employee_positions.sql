IF NOT EXISTS (SELECT 1 FROM dbo.positions WHERE position_code='COUNTER')
  INSERT dbo.positions(position_code,position_name) VALUES('COUNTER',N'Nhân viên quầy');
ELSE
  UPDATE dbo.positions SET position_name=N'Nhân viên quầy' WHERE position_code='COUNTER';
GO

UPDATE dbo.positions SET position_name=N'Nhân viên bếp' WHERE position_code='KITCHEN';
UPDATE dbo.positions SET position_name=N'Nhân viên thu ngân' WHERE position_code='CASHIER';
UPDATE dbo.positions SET position_name=N'Quản lý/Giám sát' WHERE position_code='MANAGER';
GO

DECLARE @counterId INT=(SELECT TOP 1 id FROM dbo.positions WHERE position_code='COUNTER');
DECLARE @managerId INT=(SELECT TOP 1 id FROM dbo.positions WHERE position_code='MANAGER');
UPDATE dbo.employees SET position_id=@counterId,updated_at=SYSDATETIME()
WHERE position_id IN (SELECT id FROM dbo.positions WHERE position_code IN('SERVICE','WAREHOUSE','ACCOUNTANT','STAFF'));
UPDATE dbo.employees SET position_id=@managerId,updated_at=SYSDATETIME()
WHERE position_id IN (SELECT id FROM dbo.positions WHERE position_code='SUPERVISOR');
GO
