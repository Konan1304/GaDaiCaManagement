UPDATE dbo.users
SET email = LEFT(email, LEN(email) - LEN('@daiga.vn')) + '@gdc.vn',
    updated_at = SYSDATETIME()
WHERE email LIKE '%@daiga.vn';
GO
