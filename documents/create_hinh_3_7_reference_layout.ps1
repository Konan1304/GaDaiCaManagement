Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$outputDir = Join-Path (Get-Location) 'documents\chapter3_assets'
[System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
$outputPath = Join-Path $outputDir 'Hinh_3_7_ERD_SQL_Server_FINAL.png'

$canvasWidth = 2560
$canvasHeight = 1440
$headerHeight = 38
$rowHeight = 25

function New-Column {
    param([string]$Name, [string]$Type, [string]$Key = '')
    [PSCustomObject]@{ Name = $Name; Type = $Type; Key = $Key }
}

function New-Table {
    param([string]$Name, [int]$X, [int]$Y, [int]$Width, [object[]]$Columns, [bool]$Selected = $false, [bool]$Scrollbar = $false)
    [PSCustomObject]@{
        Name = $Name
        X = $X
        Y = $Y
        Width = $Width
        Height = $headerHeight + ($Columns.Count * $rowHeight) + 6
        Columns = $Columns
        Selected = $Selected
        Scrollbar = $Scrollbar
    }
}

function Get-ColumnCenterY {
    param($Table, [string]$ColumnName)
    $index = 0
    for ($i = 0; $i -lt $Table.Columns.Count; $i++) {
        if ($Table.Columns[$i].Name -eq $ColumnName) { $index = $i; break }
    }
    [float]($Table.Y + $headerHeight + ($index * $rowHeight) + ($rowHeight / 2))
}

function Draw-KeyIcon {
    param($Graphics, [float]$X, [float]$Y)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F0C300'))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#9B7900')), 1.4
    $Graphics.FillEllipse($brush, $X, $Y, 9, 9)
    $Graphics.DrawEllipse($pen, $X, $Y, 9, 9)
    $Graphics.DrawLine($pen, $X + 8, $Y + 5, $X + 20, $Y + 5)
    $Graphics.DrawLine($pen, $X + 15, $Y + 5, $X + 15, $Y + 9)
    $Graphics.DrawLine($pen, $X + 19, $Y + 5, $X + 19, $Y + 8)
    $brush.Dispose(); $pen.Dispose()
}

function Draw-TableBox {
    param($Graphics, $Table, $Fonts)
    $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 0, 0, 0))
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $border = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#777777')), 1.2
    $rowLine = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#E1E1E1')), 1
    $headerColor = if ($Table.Selected) { '#087CCB' } else { '#D7D7D7' }
    $headerTextColor = if ($Table.Selected) { '#FFFFFF' } else { '#111111' }
    $header = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($headerColor))
    $headerText = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($headerTextColor))
    $text = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#222222'))
    $typeText = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#686868'))

    $Graphics.FillRectangle($shadow, $Table.X + 6, $Table.Y + 7, $Table.Width, $Table.Height)
    $Graphics.FillRectangle($white, $Table.X, $Table.Y, $Table.Width, $Table.Height)
    $Graphics.DrawRectangle($border, $Table.X, $Table.Y, $Table.Width, $Table.Height)
    $Graphics.FillRectangle($header, $Table.X + 1, $Table.Y + 1, $Table.Width - 2, $headerHeight - 1)
    $Graphics.DrawString($Table.Name, $Fonts.TableTitle, $headerText, $Table.X + 10, $Table.Y + 8)

    for ($i = 0; $i -lt $Table.Columns.Count; $i++) {
        $column = $Table.Columns[$i]
        $rowY = $Table.Y + $headerHeight + ($i * $rowHeight)
        $Graphics.DrawLine($rowLine, $Table.X + 1, $rowY, $Table.X + $Table.Width - 2, $rowY)
        if ($column.Key -eq 'PK') {
            Draw-KeyIcon $Graphics ($Table.X + 8) ($rowY + 8)
        } elseif ($column.Key -eq 'FK') {
            $fkBack = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#DEEBFF'))
            $fkText = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2E65B7'))
            $Graphics.FillRectangle($fkBack, $Table.X + 7, $rowY + 4, 27, 17)
            $Graphics.DrawString('FK', $Fonts.Badge, $fkText, $Table.X + 11, $rowY + 5)
            $fkBack.Dispose(); $fkText.Dispose()
        }
        $Graphics.DrawString($column.Name, $Fonts.Column, $text, $Table.X + 41, $rowY + 4)
        $typeWidth = $Graphics.MeasureString($column.Type, $Fonts.Type).Width
        $rightPadding = if ($Table.Scrollbar) { 20 } else { 8 }
        $Graphics.DrawString($column.Type, $Fonts.Type, $typeText, $Table.X + $Table.Width - $typeWidth - $rightPadding, $rowY + 6)
    }

    if ($Table.Scrollbar) {
        $track = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#EEEEEE'))
        $thumb = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#9E9E9E'))
        $trackX = $Table.X + $Table.Width - 11
        $trackY = $Table.Y + $headerHeight + 3
        $trackHeight = $Table.Height - $headerHeight - 8
        $Graphics.FillRectangle($track, $trackX, $trackY, 7, $trackHeight)
        $Graphics.FillRectangle($thumb, $trackX + 1, $trackY + 8, 5, [Math]::Max(52, [int]($trackHeight * 0.45)))
        $track.Dispose(); $thumb.Dispose()
    }

    $shadow.Dispose(); $white.Dispose(); $border.Dispose(); $rowLine.Dispose(); $header.Dispose()
    $headerText.Dispose(); $text.Dispose(); $typeText.Dispose()
}

function Draw-Relationship {
    param($Graphics, $Fonts, $Parent, [string]$ParentColumn, $Child, [string]$ChildColumn, [System.Drawing.PointF[]]$Waypoints)
    $parentY = Get-ColumnCenterY $Parent $ParentColumn
    $childY = Get-ColumnCenterY $Child $ChildColumn
    $parentOnLeft = $Parent.X -lt $Child.X
    $parentX = if ($parentOnLeft) { $Parent.X + $Parent.Width } else { $Parent.X }
    $childX = if ($parentOnLeft) { $Child.X } else { $Child.X + $Child.Width }

    $points = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $points.Add((New-Object System.Drawing.PointF([float]$parentX, [float]$parentY)))
    foreach ($point in $Waypoints) { $points.Add($point) }
    $points.Add((New-Object System.Drawing.PointF([float]$childX, [float]$childY)))

    $relationPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#777777')), 1.8
    $Graphics.DrawLines($relationPen, $points.ToArray())
    $marker = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#303030'))
    $Graphics.DrawString('1', $Fonts.Marker, $marker, $parentX - 5, $parentY - 18)
    $Graphics.DrawString('∞', $Fonts.Marker, $marker, $childX - 7, $childY - 18)
    $parentDot = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F0C300'))
    $Graphics.FillEllipse($parentDot, $parentX - 3, $parentY - 3, 6, 6)
    $Graphics.FillEllipse($marker, $childX - 3, $childY - 3, 6, 6)
    $relationPen.Dispose(); $marker.Dispose(); $parentDot.Dispose()
}

$tables = @{}
$tables.users = New-Table 'users' 150 160 390 @(
    (New-Column 'id' 'int' 'PK'), (New-Column 'role_id' 'int' 'FK'),
    (New-Column 'full_name' 'nvarchar(150)'), (New-Column 'email' 'varchar(150)'),
    (New-Column 'password_hash' 'varchar(255)'), (New-Column 'phone' 'varchar(20)'),
    (New-Column 'avatar_url' 'varchar(500)'), (New-Column 'status' 'varchar(20)'),
    (New-Column 'last_login_at' 'datetime2')
) $false $true

$tables.admin_audit_logs = New-Table 'admin_audit_logs' 700 55 400 @(
    (New-Column 'id' 'bigint' 'PK'), (New-Column 'user_id' 'int' 'FK'),
    (New-Column 'action' 'varchar(100)'), (New-Column 'entity_type' 'varchar(80)'),
    (New-Column 'entity_id' 'varchar(80)'), (New-Column 'details_json' 'nvarchar(max)')
)

$tables.employees = New-Table 'employees' 1220 145 460 @(
    (New-Column 'id' 'int' 'PK'), (New-Column 'user_id' 'int' 'FK'),
    (New-Column 'branch_id' 'int' 'FK'), (New-Column 'position_id' 'int' 'FK'),
    (New-Column 'employee_code' 'varchar(30)'), (New-Column 'birth_date' 'date'),
    (New-Column 'gender' 'varchar(10)'), (New-Column 'address' 'nvarchar(300)'),
    (New-Column 'hire_date' 'date'), (New-Column 'base_salary' 'decimal(18,2)'),
    (New-Column 'status' 'varchar(20)'), (New-Column 'created_at' 'datetime2'),
    (New-Column 'updated_at' 'datetime2')
) $true $true

$tables.branches = New-Table 'branches' 75 595 390 @(
    (New-Column 'id' 'int' 'PK'), (New-Column 'branch_code' 'varchar(30)'),
    (New-Column 'branch_name' 'nvarchar(150)'), (New-Column 'phone' 'varchar(20)'),
    (New-Column 'address' 'nvarchar(300)')
)

$tables.positions = New-Table 'positions' 690 655 390 @(
    (New-Column 'id' 'int' 'PK'), (New-Column 'position_code' 'varchar(30)'),
    (New-Column 'position_name' 'nvarchar(100)'), (New-Column 'description' 'nvarchar(255)')
)

$tables.shifts = New-Table 'shifts' 1190 795 405 @(
    (New-Column 'id' 'int' 'PK'), (New-Column 'shift_code' 'varchar(30)'),
    (New-Column 'shift_name' 'nvarchar(100)'), (New-Column 'start_time' 'time'),
    (New-Column 'end_time' 'time'), (New-Column 'break_minutes' 'int')
)

$tables.employee_schedules = New-Table 'employee_schedules' 230 955 465 @(
    (New-Column 'id' 'int' 'PK'), (New-Column 'employee_id' 'int' 'FK'),
    (New-Column 'shift_id' 'int' 'FK'), (New-Column 'branch_id' 'int' 'FK'),
    (New-Column 'work_date' 'date'), (New-Column 'work_position' 'nvarchar(100)'),
    (New-Column 'note' 'nvarchar(500)'), (New-Column 'status' 'varchar(20)'),
    (New-Column 'created_by' 'int'), (New-Column 'created_at' 'datetime2'),
    (New-Column 'updated_at' 'datetime2'), (New-Column 'approved_by' 'int')
) $false $true

$tables.payrolls = New-Table 'payrolls' 1845 865 465 @(
    (New-Column 'id' 'bigint' 'PK'), (New-Column 'employee_id' 'int' 'FK'),
    (New-Column 'payroll_month' 'date'), (New-Column 'total_work_days' 'int'),
    (New-Column 'total_work_hours' 'decimal(10,2)'), (New-Column 'hourly_rate' 'decimal(18,2)'),
    (New-Column 'base_salary' 'decimal(18,2)'), (New-Column 'parking_allowance' 'decimal(18,2)'),
    (New-Column 'meal_allowance' 'decimal(18,2)'), (New-Column 'other_allowance' 'decimal(18,2)'),
    (New-Column 'bonus' 'decimal(18,2)'), (New-Column 'salary_advance' 'decimal(18,2)'),
    (New-Column 'net_salary' 'decimal(18,2)')
) $false $true

$bitmap = New-Object System.Drawing.Bitmap $canvasWidth, $canvasHeight
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F5F5F5'))

$fonts = [PSCustomObject]@{
    TableTitle = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
    Column = New-Object System.Drawing.Font('Segoe UI', 10.5, [System.Drawing.FontStyle]::Regular)
    Type = New-Object System.Drawing.Font('Segoe UI', 8.2, [System.Drawing.FontStyle]::Regular)
    Badge = New-Object System.Drawing.Font('Segoe UI', 7.2, [System.Drawing.FontStyle]::Bold)
    Marker = New-Object System.Drawing.Font('Segoe UI Symbol', 11, [System.Drawing.FontStyle]::Bold)
}

# Vẽ đúng tám quan hệ đã yêu cầu, dùng các đoạn gấp khúc vuông góc.
Draw-Relationship $graphics $fonts $tables.users 'id' $tables.admin_audit_logs 'user_id' @(
    (New-Object System.Drawing.PointF(610, 210)), (New-Object System.Drawing.PointF(610, 118))
)
Draw-Relationship $graphics $fonts $tables.users 'id' $tables.employees 'user_id' @(
    (New-Object System.Drawing.PointF(880, 210)), (New-Object System.Drawing.PointF(880, 220))
)
Draw-Relationship $graphics $fonts $tables.branches 'id' $tables.employees 'branch_id' @(
    (New-Object System.Drawing.PointF(1125, 646)), (New-Object System.Drawing.PointF(1125, 245))
)
Draw-Relationship $graphics $fonts $tables.positions 'id' $tables.employees 'position_id' @(
    (New-Object System.Drawing.PointF(1145, 706)), (New-Object System.Drawing.PointF(1145, 270))
)
Draw-Relationship $graphics $fonts $tables.employees 'id' $tables.employee_schedules 'employee_id' @(
    (New-Object System.Drawing.PointF(1150, 196)), (New-Object System.Drawing.PointF(1150, 1030)),
    (New-Object System.Drawing.PointF(760, 1030))
)
Draw-Relationship $graphics $fonts $tables.shifts 'id' $tables.employee_schedules 'shift_id' @(
    (New-Object System.Drawing.PointF(1010, 846)), (New-Object System.Drawing.PointF(1010, 1055))
)
Draw-Relationship $graphics $fonts $tables.branches 'id' $tables.employee_schedules 'branch_id' @(
    (New-Object System.Drawing.PointF(32, 646)), (New-Object System.Drawing.PointF(32, 1080)),
    (New-Object System.Drawing.PointF(160, 1080))
)
Draw-Relationship $graphics $fonts $tables.employees 'id' $tables.payrolls 'employee_id' @(
    (New-Object System.Drawing.PointF(1755, 196)), (New-Object System.Drawing.PointF(1755, 940))
)

foreach ($name in @('users','admin_audit_logs','employees','branches','positions','shifts','employee_schedules','payrolls')) {
    Draw-TableBox $graphics $tables[$name] $fonts
}

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
$fonts.PSObject.Properties.Value | ForEach-Object { $_.Dispose() }
Write-Output $outputPath
