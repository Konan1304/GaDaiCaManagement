Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$assetDir = Join-Path (Get-Location) 'documents\chapter3_assets'
$schemaPath = Join-Path $assetDir 'Hinh_3_7_schema_snapshot.json'
$outputPath = Join-Path $assetDir 'Hinh_3_7_SQLServer_truc_tiep.png'
$schema = Get-Content -LiteralPath $schemaPath -Raw -Encoding UTF8 | ConvertFrom-Json

$canvasWidth = 2500
$canvasHeight = 1500
$headerHeight = 42
$rowHeight = 27
$maxVisibleRows = 10

$positions = @{
    users              = @{ X = 60;   Y = 180;  W = 385 }
    branches           = @{ X = 60;   Y = 600;  W = 385 }
    positions          = @{ X = 60;   Y = 1030; W = 385 }
    employees          = @{ X = 600;  Y = 415;  W = 445 }
    shifts             = @{ X = 1160; Y = 180;  W = 400 }
    employee_schedules = @{ X = 1160; Y = 600;  W = 445 }
    attendance_logs    = @{ X = 1750; Y = 600;  W = 445 }
    payrolls           = @{ X = 1750; Y = 1030; W = 445 }
}

$tables = @{}
foreach ($table in $schema.tables) {
    $position = $positions[$table.name]
    $visibleRows = [Math]::Min($maxVisibleRows, $table.columns.Count)
    $height = $headerHeight + ($visibleRows * $rowHeight) + 8
    $tables[$table.name] = [PSCustomObject]@{
        Name = $table.name
        Columns = @($table.columns)
        X = [int]$position.X
        Y = [int]$position.Y
        W = [int]$position.W
        H = [int]$height
    }
}

function Get-ColumnY {
    param($Table, [string]$ColumnName)
    $index = 0
    for ($i = 0; $i -lt $Table.Columns.Count; $i++) {
        if ($Table.Columns[$i].columnName -eq $ColumnName) { $index = $i; break }
    }
    if ($index -ge $maxVisibleRows) { $index = $maxVisibleRows - 1 }
    return [float]($Table.Y + $headerHeight + ($index * $rowHeight) + ($rowHeight / 2))
}

function Format-SqlType {
    param($Column)
    $type = [string]$Column.dataType
    if ($type -in @('varchar','char','varbinary','binary')) {
        $length = if ([int]$Column.maxLength -eq -1) { 'max' } else { [string][int]$Column.maxLength }
        return "$type($length)"
    }
    if ($type -in @('nvarchar','nchar')) {
        $length = if ([int]$Column.maxLength -eq -1) { 'max' } else { [string]([int]$Column.maxLength / 2) }
        return "$type($length)"
    }
    if ($type -in @('decimal','numeric')) {
        return "$type($([int]$Column.numericPrecision),$([int]$Column.numericScale))"
    }
    return $type
}

function Draw-Table {
    param($Graphics, $Table, $Fonts)
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#777777')), 1
    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $headerColor = if ($Table.Name -eq 'employees') { '#0078D4' } else { '#D9D9D9' }
    $headerTextColor = if ($Table.Name -eq 'employees') { '#FFFFFF' } else { '#111111' }
    $headerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($headerColor))
    $headerTextBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($headerTextColor))
    $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#252525'))
    $mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#666666'))
    $linePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#E1E1E1')), 1

    $Graphics.FillRectangle($whiteBrush, $Table.X, $Table.Y, $Table.W, $Table.H)
    $Graphics.DrawRectangle($borderPen, $Table.X, $Table.Y, $Table.W, $Table.H)
    $Graphics.FillRectangle($headerBrush, $Table.X + 1, $Table.Y + 1, $Table.W - 2, $headerHeight - 1)
    $Graphics.DrawString($Table.Name, $Fonts.TableTitle, $headerTextBrush, $Table.X + 10, $Table.Y + 9)

    $visibleCount = [Math]::Min($maxVisibleRows, $Table.Columns.Count)
    for ($i = 0; $i -lt $visibleCount; $i++) {
        $column = $Table.Columns[$i]
        $rowY = $Table.Y + $headerHeight + ($i * $rowHeight)
        $Graphics.DrawLine($linePen, $Table.X + 1, $rowY, $Table.X + $Table.W - 2, $rowY)
        if ([int]$column.isPrimaryKey -eq 1) {
            $keyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F2C811'))
            $Graphics.FillEllipse($keyBrush, $Table.X + 10, $rowY + 8, 8, 8)
            $Graphics.DrawLine((New-Object System.Drawing.Pen($keyBrush, 2)), $Table.X + 17, $rowY + 12, $Table.X + 26, $rowY + 12)
            $keyBrush.Dispose()
        } elseif ([int]$column.isForeignKey -eq 1) {
            $fkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#DCE9FF'))
            $fkText = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2D63B8'))
            $Graphics.FillRectangle($fkBrush, $Table.X + 7, $rowY + 5, 24, 17)
            $Graphics.DrawString('FK', $Fonts.Badge, $fkText, $Table.X + 10, $rowY + 6)
            $fkBrush.Dispose(); $fkText.Dispose()
        }
        $Graphics.DrawString([string]$column.columnName, $Fonts.Column, $textBrush, $Table.X + 38, $rowY + 5)
        $type = Format-SqlType $column
        $typeWidth = $Graphics.MeasureString($type, $Fonts.Type).Width
        $Graphics.DrawString($type, $Fonts.Type, $mutedBrush, $Table.X + $Table.W - $typeWidth - 19, $rowY + 7)
    }

    if ($Table.Columns.Count -gt $maxVisibleRows) {
        $trackBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#EFEFEF'))
        $thumbBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#A8A8A8'))
        $trackX = $Table.X + $Table.W - 11
        $trackY = $Table.Y + $headerHeight + 3
        $trackH = $Table.H - $headerHeight - 8
        $thumbH = [Math]::Max(42, [int]($trackH * $maxVisibleRows / $Table.Columns.Count))
        $Graphics.FillRectangle($trackBrush, $trackX, $trackY, 8, $trackH)
        $Graphics.FillRectangle($thumbBrush, $trackX + 1, $trackY + 3, 6, $thumbH)
        $trackBrush.Dispose(); $thumbBrush.Dispose()
    }

    $borderPen.Dispose(); $whiteBrush.Dispose(); $headerBrush.Dispose(); $headerTextBrush.Dispose()
    $textBrush.Dispose(); $mutedBrush.Dispose(); $linePen.Dispose()
}

function Draw-Relation {
    param($Graphics, $ChildTable, $ParentTable, $Relation, $Fonts)
    $childOnRight = $ChildTable.X -lt $ParentTable.X
    $childX = if ($childOnRight) { $ChildTable.X + $ChildTable.W } else { $ChildTable.X }
    $parentX = if ($childOnRight) { $ParentTable.X } else { $ParentTable.X + $ParentTable.W }
    $childY = Get-ColumnY $ChildTable $Relation.childColumn
    $parentY = Get-ColumnY $ParentTable $Relation.parentColumn
    $middleX = [float](($childX + $parentX) / 2)

    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#696969')), 2
    $points = @(
        (New-Object System.Drawing.PointF([float]$childX, [float]$childY)),
        (New-Object System.Drawing.PointF($middleX, [float]$childY)),
        (New-Object System.Drawing.PointF($middleX, [float]$parentY)),
        (New-Object System.Drawing.PointF([float]$parentX, [float]$parentY))
    )
    $Graphics.DrawLines($pen, $points)
    $markerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#333333'))
    $Graphics.DrawString('∞', $Fonts.Marker, $markerBrush, $childX - 7, $childY - 19)
    $Graphics.DrawString('1', $Fonts.Marker, $markerBrush, $parentX - 5, $parentY - 19)
    $markerBrush.Dispose(); $pen.Dispose()
}

$bitmap = New-Object System.Drawing.Bitmap $canvasWidth, $canvasHeight
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::White)

$fonts = [PSCustomObject]@{
    Title = New-Object System.Drawing.Font('Segoe UI', 28, [System.Drawing.FontStyle]::Bold)
    Subtitle = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Regular)
    TableTitle = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
    Column = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)
    Type = New-Object System.Drawing.Font('Segoe UI', 8, [System.Drawing.FontStyle]::Regular)
    Badge = New-Object System.Drawing.Font('Segoe UI', 7, [System.Drawing.FontStyle]::Bold)
    Marker = New-Object System.Drawing.Font('Segoe UI Symbol', 12, [System.Drawing.FontStyle]::Bold)
    Footer = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Regular)
}

$titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#1F1F1F'))
$subtitleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#666666'))
$blueBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#0078D4'))
$graphics.FillRectangle($blueBrush, 55, 42, 8, 78)
$graphics.DrawString('DATABASE DIAGRAM – NHÂN VIÊN, LỊCH LÀM VIỆC, CHẤM CÔNG VÀ TIỀN LƯƠNG', $fonts.Title, $titleBrush, 82, 38)
$graphics.DrawString("Nguồn trực tiếp: $($schema.database) • 8 bảng • quan hệ nghiệp vụ chính", $fonts.Subtitle, $subtitleBrush, 84, 91)

$excludedAuditColumns = @('created_by','updated_by','approved_by')
$mainRelations = @($schema.relations | Where-Object { $_.childColumn -notin $excludedAuditColumns })
foreach ($relation in $mainRelations) {
    Draw-Relation $graphics $tables[$relation.childTable] $tables[$relation.parentTable] $relation $fonts
}
foreach ($name in @('users','branches','positions','employees','shifts','employee_schedules','attendance_logs','payrolls')) {
    Draw-Table $graphics $tables[$name] $fonts
}

$graphics.DrawString('PK: khóa chính   FK: khóa ngoại   1–∞: quan hệ một–nhiều', $fonts.Footer, $subtitleBrush, 60, 1455)
$graphics.DrawString('Đã lược bỏ các đường created_by, updated_by, approved_by để sơ đồ dễ đọc trong báo cáo.', $fonts.Footer, $subtitleBrush, 1390, 1455)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose(); $titleBrush.Dispose(); $subtitleBrush.Dispose(); $blueBrush.Dispose()
$fonts.PSObject.Properties.Value | ForEach-Object { $_.Dispose() }
Write-Output $outputPath
