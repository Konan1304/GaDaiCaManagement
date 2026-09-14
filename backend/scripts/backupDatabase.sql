DECLARE @file NVARCHAR(500)=N'/var/opt/mssql/backups/GaDaiCaManagement_'+CONVERT(char(8),GETDATE(),112)+N'.bak';
BACKUP DATABASE GaDaiCaManagement TO DISK=@file WITH INIT,COMPRESSION,CHECKSUM;
