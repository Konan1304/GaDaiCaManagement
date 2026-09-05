IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID('dbo.shift_sessions')
    AND name='UX_shift_sessions_operation'
)
  DROP INDEX UX_shift_sessions_operation ON dbo.shift_sessions;
GO

CREATE UNIQUE INDEX UX_shift_sessions_operation
ON dbo.shift_sessions(branch_id,business_date,operation_shift_code,is_test)
WHERE operation_shift_code IS NOT NULL
  AND status<>'cancelled'
  AND status<>'CANCELLED';
GO
