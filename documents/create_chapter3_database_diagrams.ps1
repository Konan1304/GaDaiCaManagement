Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$OutputDir = Join-Path (Get-Location) 'documents\chapter3_assets'
[System.IO.Directory]::CreateDirectory($OutputDir) | Out-Null

function New-TableSpec {
    param(
        [string]$Id,
        [string]$Title,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [string[]]$Columns,
        [string]$Accent = '#F5B700'
    )
    $rowHeight = 34
    $headerHeight = 58
    return [PSCustomObject]@{
        Id = $Id
        Title = $Title
        X = $X
        Y = $Y
        Width = $Width
        Height = $headerHeight + ($Columns.Count * $rowHeight) + 12
        Columns = $Columns
        Accent = $Accent
    }
}

function New-Relation {
    param([string]$Child, [string]$Parent, [string]$Label = 'N : 1')
    return [PSCustomObject]@{ Child = $Child; Parent = $Parent; Label = $Label }
}

function Draw-RoundedRectangle {
    param($Graphics, $Pen, $Brush, [float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    if ($Brush) { $Graphics.FillPath($Brush, $path) }
    if ($Pen) { $Graphics.DrawPath($Pen, $path) }
    $path.Dispose()
}

function Get-AnchorPair {
    param($Child, $Parent)
    $childTable = @($Child)[0]
    $parentTable = @($Parent)[0]
    $childX = [double]($childTable.X)
    $childY = [double]($childTable.Y)
    $childWidth = [double]($childTable.Width)
    $childHeight = [double]($childTable.Height)
    $parentX = [double]($parentTable.X)
    $parentY = [double]($parentTable.Y)
    $parentWidth = [double]($parentTable.Width)
    $parentHeight = [double]($parentTable.Height)
    $cx = $childX + ($childWidth / 2)
    $cy = $childY + ($childHeight / 2)
    $px = $parentX + ($parentWidth / 2)
    $py = $parentY + ($parentHeight / 2)
    $dx = $px - $cx
    $dy = $py - $cy
    if ([Math]::Abs($dx) -ge [Math]::Abs($dy)) {
        if ($dx -ge 0) {
            return @(($childX + $childWidth), $cy, $parentX, $py)
        }
        return @($childX, $cy, ($parentX + $parentWidth), $py)
    }
    if ($dy -ge 0) {
        return @($cx, ($childY + $childHeight), $px, $parentY)
    }
    return @($cx, $childY, $px, ($parentY + $parentHeight))
}

function Draw-Table {
    param($Graphics, $Table, $Fonts)
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 30, 41, 59))
    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#D7DCE5')), 2
    Draw-RoundedRectangle $Graphics $null $shadowBrush ($Table.X + 8) ($Table.Y + 10) $Table.Width $Table.Height 18
    Draw-RoundedRectangle $Graphics $borderPen $whiteBrush $Table.X $Table.Y $Table.Width $Table.Height 18

    $headerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#171A20'))
    $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Table.Accent))
    $headerRect = New-Object System.Drawing.RectangleF($Table.X, $Table.Y, $Table.Width, 58)
    $Graphics.FillRectangle($headerBrush, $headerRect)
    $Graphics.FillRectangle($accentBrush, $Table.X, $Table.Y, 9, 58)
    $titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $Graphics.DrawString($Table.Title, $Fonts.TableTitle, $titleBrush, $Table.X + 24, $Table.Y + 14)

    $rowY = $Table.Y + 58
    for ($i = 0; $i -lt $Table.Columns.Count; $i++) {
        $parts = $Table.Columns[$i].Split('|')
        $kind = $parts[0]
        $name = $parts[1]
        $type = if ($parts.Count -gt 2) { $parts[2] } else { '' }
        if (($i % 2) -eq 1) {
            $alt = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F8F9FB'))
            $Graphics.FillRectangle($alt, $Table.X + 2, $rowY, $Table.Width - 4, 34)
            $alt.Dispose()
        }
        if ($kind) {
            $badgeColor = if ($kind -eq 'PK') { '#FFF1B8' } elseif ($kind -eq 'FK') { '#E9EEFF' } else { '#E7F7EF' }
            $badgeText = if ($kind -eq 'PK') { '#8A6200' } elseif ($kind -eq 'FK') { '#3C55B5' } else { '#08734A' }
            $badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($badgeColor))
            $badgeTextBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($badgeText))
            $Graphics.FillRectangle($badgeBrush, $Table.X + 15, $rowY + 7, 43, 21)
            $Graphics.DrawString($kind, $Fonts.Badge, $badgeTextBrush, $Table.X + 22, $rowY + 9)
            $badgeBrush.Dispose(); $badgeTextBrush.Dispose()
        }
        $nameBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#22262D'))
        $typeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#7B8493'))
        $Graphics.DrawString($name, $Fonts.Column, $nameBrush, $Table.X + 70, $rowY + 7)
        if ($type) {
            $size = $Graphics.MeasureString($type, $Fonts.Type)
            $Graphics.DrawString($type, $Fonts.Type, $typeBrush, $Table.X + $Table.Width - $size.Width - 15, $rowY + 9)
        }
        $linePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#E9ECF1')), 1
        $Graphics.DrawLine($linePen, $Table.X + 12, $rowY + 33, $Table.X + $Table.Width - 12, $rowY + 33)
        $linePen.Dispose(); $nameBrush.Dispose(); $typeBrush.Dispose()
        $rowY += 34
    }
    $shadowBrush.Dispose(); $whiteBrush.Dispose(); $borderPen.Dispose(); $headerBrush.Dispose(); $accentBrush.Dispose(); $titleBrush.Dispose()
}

function New-DatabaseDiagram {
    param(
        [string]$FileName,
        [string]$Figure,
        [string]$Title,
        [string]$Subtitle,
        [int]$Width,
        [int]$Height,
        [object[]]$Tables,
        [object[]]$Relations
    )
    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F4F6F9'))

    $fonts = [PSCustomObject]@{
        Figure = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
        Title = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold)
        Subtitle = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Regular)
        TableTitle = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
        Column = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Regular)
        Type = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)
        Badge = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
        Relation = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
        Legend = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Regular)
    }

    $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#171A20'))
    $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#687181'))
    $yellow = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F5B700'))
    $graphics.FillRectangle($yellow, 62, 56, 11, 95)
    $graphics.DrawString($Figure, $fonts.Figure, $muted, 95, 54)
    $graphics.DrawString($Title, $fonts.Title, $dark, 95, 88)
    $graphics.DrawString($Subtitle, $fonts.Subtitle, $muted, 98, 143)

    $map = @{}
    foreach ($table in $Tables) { $map[$table.Id] = $table }

    foreach ($relation in $Relations) {
        if (-not $map.ContainsKey($relation.Child) -or -not $map.ContainsKey($relation.Parent)) { continue }
        $childTable = $map[$relation.Child]
        $parentTable = $map[$relation.Parent]
        $anchors = Get-AnchorPair -Child $childTable -Parent $parentTable
        $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#91A0B5')), 3
        $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
        $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 6, 7, $true
        $pen.CustomEndCap = $cap
        $graphics.DrawLine($pen, $anchors[0], $anchors[1], $anchors[2], $anchors[3])
        $mx = ($anchors[0] + $anchors[2]) / 2
        $my = ($anchors[1] + $anchors[3]) / 2
        $labelSize = $graphics.MeasureString($relation.Label, $fonts.Relation)
        $labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 255, 255, 255))
        $graphics.FillRectangle($labelBrush, $mx - ($labelSize.Width / 2) - 5, $my - ($labelSize.Height / 2) - 2, $labelSize.Width + 10, $labelSize.Height + 4)
        $graphics.DrawString($relation.Label, $fonts.Relation, $muted, $mx - ($labelSize.Width / 2), $my - ($labelSize.Height / 2))
        $labelBrush.Dispose(); $cap.Dispose(); $pen.Dispose()
    }

    foreach ($table in $Tables) { Draw-Table $graphics $table $fonts }

    $legendY = $Height - 54
    $graphics.DrawString('PK: khóa chính     FK: khóa ngoại     Đường nét đứt: bảng con tham chiếu bảng cha (N : 1)', $fonts.Legend, $muted, 65, $legendY)
    $graphics.DrawString('Nguồn: database/schema.sql và database/migrations của hệ thống Gà Đại Ca', $fonts.Legend, $muted, $Width - 860, $legendY)

    $outputPath = Join-Path $OutputDir $FileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose(); $dark.Dispose(); $muted.Dispose(); $yellow.Dispose()
    $fonts.PSObject.Properties.Value | ForEach-Object { $_.Dispose() }
    Write-Output $outputPath
}

# Hình 3.7: nhân viên, đăng ký lịch, lịch làm, chấm công và lương.
$tables37 = @(
    (New-TableSpec 'roles' 'roles' 55 220 370 @('PK|id|INT','|role_code|VARCHAR','|role_name|NVARCHAR') '#7A63D8'),
    (New-TableSpec 'users' 'users' 485 220 410 @('PK|id|INT','FK|role_id|INT','|full_name|NVARCHAR','|email|VARCHAR','|status|VARCHAR') '#7A63D8'),
    (New-TableSpec 'branches' 'branches' 55 610 370 @('PK|id|INT','|branch_code|VARCHAR','|branch_name|NVARCHAR','|status|VARCHAR') '#16A085'),
    (New-TableSpec 'positions' 'positions' 485 640 410 @('PK|id|INT','|position_code|VARCHAR','|position_name|NVARCHAR') '#16A085'),
    (New-TableSpec 'employees' 'employees' 940 365 440 @('PK|id|INT','FK|user_id|INT','FK|branch_id|INT','FK|position_id|INT','|employee_code|VARCHAR','|hire_date|DATE','|status|VARCHAR') '#F5B700'),
    (New-TableSpec 'periods' 'schedule_registration_periods' 1450 205 470 @('PK|id|INT','FK|branch_id|INT','|week_start_date|DATE','|week_end_date|DATE','|status|VARCHAR','FK|created_by|INT') '#4F6BED'),
    (New-TableSpec 'registrations' 'employee_shift_registrations' 1990 205 500 @('PK|id|BIGINT','FK|period_id|INT','FK|employee_id|INT','FK|shift_id|INT','|work_date|DATE','|preference_level|VARCHAR') '#4F6BED'),
    (New-TableSpec 'shifts' 'shifts' 1450 610 470 @('PK|id|INT','|shift_code|VARCHAR','|shift_name|NVARCHAR','|start_time|TIME','|end_time|TIME','|shift_type|VARCHAR') '#4F6BED'),
    (New-TableSpec 'schedules' 'employee_schedules' 1990 620 500 @('PK|id|INT','FK|employee_id|INT','FK|shift_id|INT','FK|branch_id|INT','|work_date|DATE','|status|VARCHAR') '#4F6BED'),
    (New-TableSpec 'attendance' 'attendance_logs' 520 1120 470 @('PK|id|BIGINT','FK|employee_id|INT','FK|schedule_id|INT','FK|branch_id|INT','|check_in_time|DATETIME2','|check_out_time|DATETIME2','|status|VARCHAR') '#E67E22'),
    (New-TableSpec 'salary' 'salary_settings' 1080 1120 470 @('PK|id|INT','FK|employee_id|INT','FK|position_id|INT','|hourly_rate|DECIMAL','|effective_from|DATE','|effective_to|DATE') '#E67E22'),
    (New-TableSpec 'payrolls' 'payrolls' 1640 1090 500 @('PK|id|BIGINT','FK|employee_id|INT','|payroll_month|DATE','|total_work_hours|DECIMAL','|hourly_rate|DECIMAL','|base_salary|DECIMAL','|net_salary|DECIMAL','|status|VARCHAR') '#E67E22')
)
$relations37 = @(
    (New-Relation 'users' 'roles'),(New-Relation 'employees' 'users'),(New-Relation 'employees' 'branches'),(New-Relation 'employees' 'positions'),
    (New-Relation 'periods' 'branches'),(New-Relation 'registrations' 'periods'),(New-Relation 'registrations' 'employees'),(New-Relation 'registrations' 'shifts'),
    (New-Relation 'schedules' 'employees'),(New-Relation 'schedules' 'shifts'),(New-Relation 'schedules' 'branches'),
    (New-Relation 'attendance' 'employees'),(New-Relation 'attendance' 'schedules'),(New-Relation 'salary' 'employees'),(New-Relation 'salary' 'positions'),(New-Relation 'payrolls' 'employees')
)
New-DatabaseDiagram 'Hinh_3_7_Database_Nhan_vien_Lich_Cham_cong_Luong.png' 'HÌNH 3.7' 'CƠ SỞ DỮ LIỆU NHÂN SỰ VÀ TIỀN LƯƠNG' 'Nhân viên • đăng ký ca • lịch làm việc • chấm công • bảng lương' 2550 1690 $tables37 $relations37

# Hình 3.8: vận hành ca và báo cáo doanh thu.
$tables38 = @(
    (New-TableSpec 'branches' 'branches' 55 230 350 @('PK|id|INT','|branch_code|VARCHAR','|branch_name|NVARCHAR') '#16A085'),
    (New-TableSpec 'shifts' 'shifts' 55 520 350 @('PK|id|INT','|shift_code|VARCHAR','|start_time|TIME','|end_time|TIME') '#16A085'),
    (New-TableSpec 'employees' 'employees' 55 825 350 @('PK|id|INT','FK|user_id|INT','FK|branch_id|INT','|employee_code|VARCHAR') '#16A085'),
    (New-TableSpec 'users' 'users' 55 1140 350 @('PK|id|INT','|full_name|NVARCHAR','|email|VARCHAR') '#7A63D8'),
    (New-TableSpec 'mappings' 'operation_shift_mappings' 480 215 430 @('PK|id|INT','FK|branch_id|INT','FK|shift_id|INT','|operation_shift_code|VARCHAR','|is_active|BIT') '#4F6BED'),
    (New-TableSpec 'assignments' 'operation_shift_assignments' 480 570 430 @('PK|id|INT','FK|branch_id|INT','FK|employee_id|INT','|business_date|DATE','|operation_shift_code|VARCHAR','|assignment_role|VARCHAR') '#4F6BED'),
    (New-TableSpec 'sessions' 'shift_sessions' 1000 440 470 @('PK|id|INT','FK|branch_id|INT','FK|employee_id|INT','FK|shift_id|INT','|business_date|DATE','|operation_shift_code|VARCHAR','|opening_cash|DECIMAL','|status|VARCHAR') '#F5B700'),
    (New-TableSpec 'reports' 'shift_closing_reports' 1570 215 480 @('PK|id|INT','FK|shift_session_id|INT','FK|employee_id|INT','|gross_sales|DECIMAL','|cash_revenue|DECIMAL','|expected_cash|DECIMAL','|actual_cash|DECIMAL','|report_status|VARCHAR') '#E67E22'),
    (New-TableSpec 'cashcounts' 'shift_cash_counts' 1570 645 480 @('PK|id|BIGINT','FK|shift_session_id|INT','FK|counted_by|INT','|denomination|INT','|quantity|INT') '#E67E22'),
    (New-TableSpec 'expenses' 'shift_expenses' 1570 990 480 @('PK|id|INT','FK|shift_session_id|INT','FK|expense_category_id|INT','FK|employee_id|INT','|amount|DECIMAL','|description|NVARCHAR') '#E67E22'),
    (New-TableSpec 'denominations' 'shift_cash_denominations' 2130 215 370 @('PK|id|BIGINT','FK|shift_closing_report_id|INT','|denomination|INT','|quantity|INT') '#9B59B6'),
    (New-TableSpec 'versions' 'shift_report_versions' 2130 535 370 @('PK|id|BIGINT','FK|shift_closing_report_id|INT','|version|INT','|snapshot_json|NVARCHAR','FK|changed_by|INT') '#9B59B6'),
    (New-TableSpec 'handovers' 'shift_handovers' 1000 1070 470 @('PK|id|BIGINT','FK|from_shift_session_id|INT','FK|to_shift_session_id|INT','FK|sent_by_employee_id|INT','FK|received_by_employee_id|INT','|difference_amount|DECIMAL','|status|VARCHAR') '#D25C77'),
    (New-TableSpec 'attachments' 'operation_attachments' 2130 900 370 @('PK|id|BIGINT','FK|shift_session_id|INT','FK|handover_id|BIGINT','|attachment_type|VARCHAR','|relative_path|NVARCHAR') '#D25C77')
)
$relations38 = @(
    (New-Relation 'mappings' 'branches'),(New-Relation 'mappings' 'shifts'),(New-Relation 'assignments' 'branches'),(New-Relation 'assignments' 'employees'),
    (New-Relation 'sessions' 'branches'),(New-Relation 'sessions' 'shifts'),(New-Relation 'sessions' 'employees'),
    (New-Relation 'reports' 'sessions'),(New-Relation 'reports' 'employees'),(New-Relation 'cashcounts' 'sessions'),(New-Relation 'cashcounts' 'users'),
    (New-Relation 'expenses' 'sessions'),(New-Relation 'expenses' 'employees'),(New-Relation 'denominations' 'reports'),(New-Relation 'versions' 'reports'),
    (New-Relation 'versions' 'users'),(New-Relation 'handovers' 'sessions'),(New-Relation 'handovers' 'employees'),(New-Relation 'attachments' 'sessions'),(New-Relation 'attachments' 'handovers')
)
New-DatabaseDiagram 'Hinh_3_8_Database_Van_hanh_ca.png' 'HÌNH 3.8' 'CƠ SỞ DỮ LIỆU VẬN HÀNH CA' 'Phân công • mở/đóng ca • doanh thu • kiểm tiền • chi phí • bàn giao' 2550 1690 $tables38 $relations38

# Hình 3.9: kho, kiểm kho và nhà cung cấp.
$tables39 = @(
    (New-TableSpec 'categories' 'categories' 55 215 360 @('PK|id|INT','|category_name|NVARCHAR','|status|VARCHAR') '#7A63D8'),
    (New-TableSpec 'units' 'units' 55 500 360 @('PK|id|INT','|unit_name|NVARCHAR','|symbol|NVARCHAR') '#7A63D8'),
    (New-TableSpec 'branches' 'branches' 55 790 360 @('PK|id|INT','|branch_code|VARCHAR','|branch_name|NVARCHAR') '#16A085'),
    (New-TableSpec 'suppliers' 'suppliers' 55 1080 360 @('PK|id|INT','|supplier_code|VARCHAR','|supplier_name|NVARCHAR','|phone|VARCHAR','|status|VARCHAR') '#16A085'),
    (New-TableSpec 'products' 'products' 500 335 420 @('PK|id|INT','FK|category_id|INT','FK|unit_id|INT','|product_code|VARCHAR','|product_name|NVARCHAR','|cost_price|DECIMAL','|min_stock_level|DECIMAL') '#F5B700'),
    (New-TableSpec 'branchstocks' 'branch_inventories' 1010 205 430 @('PK/FK|branch_id|INT','PK/FK|product_id|INT','|quantity|DECIMAL','|updated_at|DATETIME2') '#4F6BED'),
    (New-TableSpec 'transactions' 'inventory_transactions' 1010 520 430 @('PK|id|BIGINT','FK|branch_id|INT','FK|product_id|INT','|transaction_type|VARCHAR','|quantity|DECIMAL','|reference_type|VARCHAR','|created_at|DATETIME2') '#4F6BED'),
    (New-TableSpec 'receipts' 'purchase_receipts' 500 1000 420 @('PK|id|INT','FK|branch_id|INT','FK|supplier_id|INT','|receipt_code|VARCHAR','|receipt_date|DATE','|status|VARCHAR','|total_amount|DECIMAL') '#E67E22'),
    (New-TableSpec 'receiptitems' 'purchase_receipt_items' 1010 1040 430 @('PK|id|BIGINT','FK|purchase_receipt_id|INT','FK|product_id|INT','|quantity|DECIMAL','|unit_price|DECIMAL','|line_total|DECIMAL') '#E67E22'),
    (New-TableSpec 'orders' 'supplier_purchase_orders' 1515 205 450 @('PK|id|BIGINT','FK|supplier_id|INT','FK|branch_id|INT','|order_code|VARCHAR','|expected_date|DATE','|status|VARCHAR','|total_amount|DECIMAL') '#D25C77'),
    (New-TableSpec 'orderitems' 'supplier_purchase_order_items' 2050 215 450 @('PK|id|BIGINT','FK|purchase_order_id|BIGINT','FK|product_id|INT','|quantity|DECIMAL','|unit_price|DECIMAL') '#D25C77'),
    (New-TableSpec 'invsessions' 'shift_inventory_sessions' 1515 640 450 @('PK|id|BIGINT','FK|branch_id|INT','FK|shift_session_id|INT','FK|previous_inventory_session_id|BIGINT','|business_date|DATE','|operation_shift_code|VARCHAR','|status|VARCHAR') '#1596A7'),
    (New-TableSpec 'invitems' 'shift_inventory_items' 2050 640 450 @('PK|id|BIGINT','FK|session_id|BIGINT','FK|product_id|INT','FK|unit_id|INT','|opening_quantity|DECIMAL','|received_quantity|DECIMAL','|issued_quantity|DECIMAL','|closing_quantity|DECIMAL') '#1596A7'),
    (New-TableSpec 'discrepancies' 'inventory_discrepancies' 1515 1120 450 @('PK|id|BIGINT','FK|source_session_id|BIGINT','FK|receiving_session_id|BIGINT','FK|product_id|INT','|difference_quantity|DECIMAL','|status|VARCHAR') '#C74B50')
)
$relations39 = @(
    (New-Relation 'products' 'categories'),(New-Relation 'products' 'units'),(New-Relation 'branchstocks' 'branches'),(New-Relation 'branchstocks' 'products'),
    (New-Relation 'transactions' 'branches'),(New-Relation 'transactions' 'products'),(New-Relation 'receipts' 'branches'),(New-Relation 'receipts' 'suppliers'),
    (New-Relation 'receiptitems' 'receipts'),(New-Relation 'receiptitems' 'products'),(New-Relation 'orders' 'suppliers'),(New-Relation 'orders' 'branches'),
    (New-Relation 'orderitems' 'orders'),(New-Relation 'orderitems' 'products'),(New-Relation 'invsessions' 'branches'),
    (New-Relation 'invitems' 'invsessions'),(New-Relation 'invitems' 'products'),(New-Relation 'invitems' 'units'),(New-Relation 'discrepancies' 'invsessions'),(New-Relation 'discrepancies' 'products')
)
New-DatabaseDiagram 'Hinh_3_9_Database_Kho_Nha_cung_cap.png' 'HÌNH 3.9' 'CƠ SỞ DỮ LIỆU KHO VÀ NHÀ CUNG CẤP' 'Danh mục • sản phẩm • nhập/xuất • đơn hàng • kiểm kho theo ca' 2550 1690 $tables39 $relations39

# Hình 3.10: chat, thông báo, báo cáo nghiệp vụ và cài đặt.
$tables310 = @(
    (New-TableSpec 'users' 'users' 55 270 370 @('PK|id|INT','FK|role_id|INT','|full_name|NVARCHAR','|email|VARCHAR','|status|VARCHAR') '#7A63D8'),
    (New-TableSpec 'branches' 'branches' 55 665 370 @('PK|id|INT','|branch_code|VARCHAR','|branch_name|NVARCHAR','|status|VARCHAR') '#16A085'),
    (New-TableSpec 'events' 'business_events' 55 1010 370 @('PK|id|BIGINT','FK|branch_id|INT','FK|actor_user_id|INT','|event_type|VARCHAR','|payload_json|NVARCHAR') '#16A085'),
    (New-TableSpec 'channels' 'chat_channels' 500 215 430 @('PK|id|INT','FK|branch_id|INT','|channel_type|VARCHAR','|name|NVARCHAR','|is_system|BIT','|is_active|BIT') '#4F6BED'),
    (New-TableSpec 'members' 'chat_channel_members' 500 610 430 @('PK/FK|channel_id|INT','PK/FK|user_id|INT','FK|added_by|INT','|added_at|DATETIME2') '#4F6BED'),
    (New-TableSpec 'messages' 'chat_messages' 1010 310 460 @('PK|id|BIGINT','FK|channel_id|INT','FK|sender_user_id|INT','FK|reply_to_id|BIGINT','FK|business_event_id|BIGINT','|content|NVARCHAR','|is_deleted|BIT','|created_at|DATETIME2') '#F5B700'),
    (New-TableSpec 'attachments' 'chat_message_attachments' 1560 215 440 @('PK|id|BIGINT','FK|message_id|BIGINT','|original_name|NVARCHAR','|mime_type|VARCHAR','|relative_path|NVARCHAR') '#E67E22'),
    (New-TableSpec 'readstates' 'chat_read_states' 1560 565 440 @('PK/FK|channel_id|INT','PK/FK|user_id|INT','FK|last_read_message_id|BIGINT','|read_at|DATETIME2') '#E67E22'),
    (New-TableSpec 'notifications' 'notifications' 1010 970 460 @('PK|id|BIGINT','FK|user_id|INT','FK|business_event_id|BIGINT','FK|chat_message_id|BIGINT','|title|NVARCHAR','|content|NVARCHAR','|is_read|BIT') '#D25C77'),
    (New-TableSpec 'settings' 'system_settings' 1560 950 440 @('PK|id|INT','|setting_key|VARCHAR','|setting_value|NVARCHAR','FK|updated_by|INT','|updated_at|DATETIME2') '#1596A7'),
    (New-TableSpec 'audit' 'admin_audit_logs' 2075 230 420 @('PK|id|BIGINT','FK|user_id|INT','|action|VARCHAR','|entity_type|VARCHAR','|entity_id|VARCHAR','|details_json|NVARCHAR','|created_at|DATETIME2') '#C74B50'),
    (New-TableSpec 'reset' 'password_reset_requests' 2075 725 420 @('PK|id|BIGINT','FK|user_id|INT','|status|VARCHAR','FK|resolved_by|INT','|resolved_at|DATETIME2','|created_at|DATETIME2') '#C74B50'),
    (New-TableSpec 'reports' 'branch_operational_reports' 2075 1160 420 @('PK|id|BIGINT','FK|branch_id|INT','|report_type|VARCHAR','|report_date|DATE','FK|created_by|INT','|status|VARCHAR') '#9B59B6')
)
$relations310 = @(
    (New-Relation 'channels' 'branches'),(New-Relation 'members' 'channels'),(New-Relation 'members' 'users'),
    (New-Relation 'messages' 'channels'),(New-Relation 'messages' 'users'),(New-Relation 'messages' 'events'),(New-Relation 'attachments' 'messages'),
    (New-Relation 'readstates' 'channels'),(New-Relation 'readstates' 'users'),(New-Relation 'readstates' 'messages'),
    (New-Relation 'events' 'branches'),(New-Relation 'events' 'users'),(New-Relation 'notifications' 'users'),(New-Relation 'notifications' 'events'),(New-Relation 'notifications' 'messages'),
    (New-Relation 'settings' 'users'),(New-Relation 'audit' 'users'),(New-Relation 'reset' 'users'),(New-Relation 'reports' 'branches'),(New-Relation 'reports' 'users')
)
New-DatabaseDiagram 'Hinh_3_10_Database_Chat_Thong_bao_Cai_dat.png' 'HÌNH 3.10' 'CƠ SỞ DỮ LIỆU CHAT, THÔNG BÁO VÀ CÀI ĐẶT' 'Kênh chat • tệp đính kèm • trạng thái đọc • sự kiện • cấu hình • nhật ký' 2550 1690 $tables310 $relations310
