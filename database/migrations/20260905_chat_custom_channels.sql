IF EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('dbo.chat_channels') AND name='UX_cc_branch_type')
  ALTER TABLE dbo.chat_channels DROP CONSTRAINT UX_cc_branch_type;
ELSE IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.chat_channels') AND name='UX_cc_branch_type')
  DROP INDEX UX_cc_branch_type ON dbo.chat_channels;
GO
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.chat_channels') AND name='CK_cc_type')
  ALTER TABLE dbo.chat_channels DROP CONSTRAINT CK_cc_type;
GO
ALTER TABLE dbo.chat_channels ADD CONSTRAINT CK_cc_type CHECK(channel_type IN('ANNOUNCEMENT','SHIFT_HANDOVER','INVENTORY','INCIDENT','GENERAL','SCHEDULE','CUSTOM'));
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.chat_channels') AND name='UX_cc_system_branch_type')
  CREATE UNIQUE INDEX UX_cc_system_branch_type ON dbo.chat_channels(branch_id,channel_type,is_test) WHERE is_system=1;
GO
