IF COL_LENGTH('dbo.shift_closing_reports','xanh_sm_revenue') IS NULL
  ALTER TABLE dbo.shift_closing_reports ADD xanh_sm_revenue DECIMAL(18,2) NOT NULL
    CONSTRAINT DF_shift_closing_reports_xanh_sm_revenue DEFAULT 0;
