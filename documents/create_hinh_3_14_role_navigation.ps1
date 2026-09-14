Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$outputDir = Join-Path (Get-Location) 'documents\chapter3_assets'
[System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
$outputPath = Join-Path $outputDir 'Hinh_3_14_So_do_dieu_huong_theo_vai_tro.png'

# Kích thước tương đương A4 ngang ở 300 dpi, phù hợp chèn vào báo cáo Word.
$canvasWidth = 3508
$canvasHeight = 2050

function New-Point([float]$x, [float]$y) {
    return [System.Drawing.PointF]::new($x, $y)
}

function New-Rect([float]$x, [float]$y, [float]$width, [float]$height) {
    return [System.Drawing.RectangleF]::new($x, $y, $width, $height)
}

function New-RoundedRectanglePath([System.Drawing.RectangleF]$rect, [float]$radius) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $radius * 2
    $arc = [System.Drawing.RectangleF]::new($rect.X, $rect.Y, $diameter, $diameter)

    $path.AddArc($arc, 180, 90)
    $arc.X = $rect.Right - $diameter
    $path.AddArc($arc, 270, 90)
    $arc.Y = $rect.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    $arc.X = $rect.X
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

function Draw-RoundedBox {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.RectangleF]$Rect,
        [System.Drawing.Color]$FillColor,
        [System.Drawing.Color]$BorderColor,
        [float]$BorderWidth = 2,
        [float]$Radius = 18,
        [switch]$Dashed
    )

    $path = New-RoundedRectanglePath $Rect $Radius
    $brush = [System.Drawing.SolidBrush]::new($FillColor)
    $pen = [System.Drawing.Pen]::new($BorderColor, $BorderWidth)
    if ($Dashed) {
        $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    }
    $Graphics.FillPath($brush, $path)
    $Graphics.DrawPath($pen, $path)
    $pen.Dispose()
    $brush.Dispose()
    $path.Dispose()
}

function Draw-CenteredText {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [System.Drawing.RectangleF]$Rect,
        [System.Drawing.Font]$Font,
        [System.Drawing.Color]$Color
    )

    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
    $brush = [System.Drawing.SolidBrush]::new($Color)
    $Graphics.DrawString($Text, $Font, $brush, $Rect, $format)
    $brush.Dispose()
    $format.Dispose()
}

function Draw-ArrowPolyline {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.PointF[]]$Points,
        [System.Drawing.Color]$Color,
        [float]$Width = 3,
        [float]$ArrowSize = 16
    )

    if ($Points.Count -lt 2) { return }

    $pen = [System.Drawing.Pen]::new($Color, $Width)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($pen, $Points)

    $end = $Points[$Points.Count - 1]
    $previous = $Points[$Points.Count - 2]
    $dx = [double]($end.X - $previous.X)
    $dy = [double]($end.Y - $previous.Y)
    $length = [Math]::Sqrt(($dx * $dx) + ($dy * $dy))
    if ($length -gt 0) {
        $ux = $dx / $length
        $uy = $dy / $length
        $px = -$uy
        $py = $ux
        $baseX = $end.X - ($ux * $ArrowSize)
        $baseY = $end.Y - ($uy * $ArrowSize)
        $half = $ArrowSize * 0.52
        $arrow = [System.Drawing.PointF[]]@(
            (New-Point $end.X $end.Y),
            (New-Point ($baseX + ($px * $half)) ($baseY + ($py * $half))),
            (New-Point ($baseX - ($px * $half)) ($baseY - ($py * $half)))
        )
        $brush = [System.Drawing.SolidBrush]::new($Color)
        $Graphics.FillPolygon($brush, $arrow)
        $brush.Dispose()
    }
    $pen.Dispose()
}

function Draw-Line {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.PointF[]]$Points,
        [System.Drawing.Color]$Color,
        [float]$Width = 3
    )
    $pen = [System.Drawing.Pen]::new($Color, $Width)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($pen, $Points)
    $pen.Dispose()
}

function Draw-MainNode {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.RectangleF]$Rect,
        [string]$Title,
        [string]$Subtitle,
        [System.Drawing.Color]$FillColor,
        [System.Drawing.Color]$BorderColor,
        [System.Drawing.Color]$TextColor
    )

    Draw-RoundedBox $Graphics $Rect $FillColor $BorderColor 3 22
    if ([string]::IsNullOrWhiteSpace($Subtitle)) {
        Draw-CenteredText $Graphics $Title $Rect $script:fontMain $TextColor
        return
    }

    $titleRect = New-Rect $Rect.X ($Rect.Y + 9) $Rect.Width 48
    $subtitleRect = New-Rect $Rect.X ($Rect.Y + 56) $Rect.Width 28
    Draw-CenteredText $Graphics $Title $titleRect $script:fontHome $TextColor
    Draw-CenteredText $Graphics $Subtitle $subtitleRect $script:fontSubtitle $script:mutedText
}

function Draw-GroupBase {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.RectangleF]$Rect,
        [System.Drawing.Color]$FillColor,
        [System.Drawing.Color]$BorderColor
    )
    Draw-RoundedBox $Graphics $Rect $FillColor $BorderColor 2 24 -Dashed
}

function Get-GroupHeaderRect([System.Drawing.RectangleF]$CardRect) {
    return New-Rect ($CardRect.X + 85) ($CardRect.Y + 28) ($CardRect.Width - 170) 72
}

function Draw-GroupContents {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.RectangleF]$CardRect,
        [string]$GroupTitle,
        [string[]]$Items,
        [System.Drawing.Color]$HeaderFill,
        [System.Drawing.Color]$NodeFill,
        [System.Drawing.Color]$BorderColor,
        [System.Drawing.Color]$ConnectorColor
    )

    $headerRect = Get-GroupHeaderRect $CardRect
    $horizontalMargin = 70
    $columnGap = 40
    $nodeWidth = ($CardRect.Width - (2 * $horizontalMargin) - $columnGap) / 2
    $nodeHeight = 78
    $rowGap = 30
    $firstNodeY = $CardRect.Y + 145
    $rowCount = [int][Math]::Ceiling($Items.Count / 2.0)
    $trunkX = $CardRect.X + ($CardRect.Width / 2)

    # Các đường rẽ nhánh nằm phía sau khối, thể hiện các màn hình được chọn độc lập.
    $lastRowY = $firstNodeY + (($rowCount - 1) * ($nodeHeight + $rowGap))
    $lastBusY = $lastRowY - 18
    Draw-Line $Graphics ([System.Drawing.PointF[]]@(
        (New-Point $trunkX $headerRect.Bottom),
        (New-Point $trunkX $lastBusY)
    )) $ConnectorColor 2.5

    for ($row = 0; $row -lt $rowCount; $row++) {
        $firstIndex = $row * 2
        $nodeY = $firstNodeY + ($row * ($nodeHeight + $rowGap))
        $busY = $nodeY - 18
        $indices = @($firstIndex)
        if (($firstIndex + 1) -lt $Items.Count) { $indices += ($firstIndex + 1) }

        foreach ($index in $indices) {
            if ($indices.Count -eq 1) {
                $nodeX = $CardRect.X + (($CardRect.Width - $nodeWidth) / 2)
            } elseif (($index % 2) -eq 0) {
                $nodeX = $CardRect.X + $horizontalMargin
            } else {
                $nodeX = $CardRect.X + $horizontalMargin + $nodeWidth + $columnGap
            }
            $nodeCenterX = $nodeX + ($nodeWidth / 2)
            Draw-ArrowPolyline $Graphics ([System.Drawing.PointF[]]@(
                (New-Point $trunkX $busY),
                (New-Point $nodeCenterX $busY),
                (New-Point $nodeCenterX $nodeY)
            )) $ConnectorColor 2.5 13
        }
    }

    Draw-RoundedBox $Graphics $headerRect $HeaderFill $BorderColor 3 18
    Draw-CenteredText $Graphics $GroupTitle $headerRect $script:fontGroup $script:darkText

    for ($index = 0; $index -lt $Items.Count; $index++) {
        $row = [Math]::Floor($index / 2)
        $nodeY = $firstNodeY + ($row * ($nodeHeight + $rowGap))
        $isOddLast = (($Items.Count % 2) -eq 1) -and ($index -eq ($Items.Count - 1))
        if ($isOddLast) {
            $nodeX = $CardRect.X + (($CardRect.Width - $nodeWidth) / 2)
        } elseif (($index % 2) -eq 0) {
            $nodeX = $CardRect.X + $horizontalMargin
        } else {
            $nodeX = $CardRect.X + $horizontalMargin + $nodeWidth + $columnGap
        }
        $nodeRect = New-Rect $nodeX $nodeY $nodeWidth $nodeHeight
        Draw-RoundedBox $Graphics $nodeRect $NodeFill $BorderColor 2 16

        $font = $script:fontItem
        if ($Items[$index].Length -gt 24) { $font = $script:fontItemSmall }
        Draw-CenteredText $Graphics $Items[$index] $nodeRect $font $script:darkText
    }
}

$bitmap = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight)
$bitmap.SetResolution(300, 300)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::White)

$script:darkText = [System.Drawing.ColorTranslator]::FromHtml('#172033')
$script:mutedText = [System.Drawing.ColorTranslator]::FromHtml('#596579')
$connector = [System.Drawing.ColorTranslator]::FromHtml('#687487')
$authFill = [System.Drawing.ColorTranslator]::FromHtml('#FFF3BF')
$authBorder = [System.Drawing.ColorTranslator]::FromHtml('#C99700')
$adminFill = [System.Drawing.ColorTranslator]::FromHtml('#DDEBFF')
$adminSoft = [System.Drawing.ColorTranslator]::FromHtml('#F7FAFF')
$adminNode = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')
$adminBorder = [System.Drawing.ColorTranslator]::FromHtml('#4472C4')
$employeeFill = [System.Drawing.ColorTranslator]::FromHtml('#DDF4E5')
$employeeSoft = [System.Drawing.ColorTranslator]::FromHtml('#F7FCF9')
$employeeNode = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')
$employeeBorder = [System.Drawing.ColorTranslator]::FromHtml('#3A965B')

# Dùng đơn vị pixel để kích thước chữ không bị phóng theo DPI của bitmap.
$script:fontMain = [System.Drawing.Font]::new('Segoe UI', 44, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$script:fontHome = [System.Drawing.Font]::new('Segoe UI', 39, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$script:fontSubtitle = [System.Drawing.Font]::new('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$script:fontGroup = [System.Drawing.Font]::new('Segoe UI', 32, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$script:fontItem = [System.Drawing.Font]::new('Segoe UI', 29, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$script:fontItemSmall = [System.Drawing.Font]::new('Segoe UI', 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

# Các nút điều hướng cấp cao.
$loginRect = New-Rect 1504 45 500 98
$roleDecisionRect = New-Rect 1504 205 500 98
$adminRoleRect = New-Rect 580 405 480 94
$employeeRoleRect = New-Rect 2448 405 480 94
$adminHomeRect = New-Rect 570 585 500 105
$employeeHomeRect = New-Rect 2438 585 500 105

# Bốn nhóm chức năng cho mỗi vai trò.
$adminHumanRect = New-Rect 60 840 780 515
$adminOperationRect = New-Rect 880 840 780 365
$adminWarehouseRect = New-Rect 880 1285 780 445
$adminSystemRect = New-Rect 60 1435 780 475
$employeeWorkRect = New-Rect 1848 840 780 475
$employeeOperationRect = New-Rect 2668 840 780 445
$employeeReportRect = New-Rect 1848 1395 780 365
$employeePersonalRect = New-Rect 2668 1365 780 445

# Nền các cụm chức năng.
foreach ($card in @($adminHumanRect, $adminOperationRect, $adminWarehouseRect, $adminSystemRect)) {
    Draw-GroupBase $graphics $card $adminSoft $adminBorder
}
foreach ($card in @($employeeWorkRect, $employeeOperationRect, $employeeReportRect, $employeePersonalRect)) {
    Draw-GroupBase $graphics $card $employeeSoft $employeeBorder
}

# Luồng Đăng nhập -> Xác định quyền -> hai vai trò.
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1754 $loginRect.Bottom),
    (New-Point 1754 $roleDecisionRect.Top)
)) $connector 4 18

Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1754 $roleDecisionRect.Bottom),
    (New-Point 1754 350),
    (New-Point 820 350),
    (New-Point 820 374)
)) $connector 4
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 820 374),
    (New-Point 820 $adminRoleRect.Top)
)) $connector 4 18

Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1754 $roleDecisionRect.Bottom),
    (New-Point 1754 350),
    (New-Point 2688 350),
    (New-Point 2688 374)
)) $connector 4
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 2688 374),
    (New-Point 2688 $employeeRoleRect.Top)
)) $connector 4 18

Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 820 $adminRoleRect.Bottom),
    (New-Point 820 $adminHomeRect.Top)
)) $adminBorder 4 18
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 2688 $employeeRoleRect.Bottom),
    (New-Point 2688 $employeeHomeRect.Top)
)) $employeeBorder 4 18

# Bus điều hướng Admin: từ Tổng quan có thể chọn độc lập bất kỳ nhóm chức năng nào.
Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 820 $adminHomeRect.Bottom),
    (New-Point 820 770),
    (New-Point 30 770),
    (New-Point 1690 770)
)) $adminBorder 3
Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 30 770),
    (New-Point 30 1473)
)) $adminBorder 3
Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1690 770),
    (New-Point 1690 1323)
)) $adminBorder 3

$adminHumanHeader = Get-GroupHeaderRect $adminHumanRect
$adminOperationHeader = Get-GroupHeaderRect $adminOperationRect
$adminWarehouseHeader = Get-GroupHeaderRect $adminWarehouseRect
$adminSystemHeader = Get-GroupHeaderRect $adminSystemRect
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 30 ($adminHumanHeader.Y + ($adminHumanHeader.Height / 2))),
    (New-Point $adminHumanHeader.Left ($adminHumanHeader.Y + ($adminHumanHeader.Height / 2)))
)) $adminBorder 3 15
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1690 ($adminOperationHeader.Y + ($adminOperationHeader.Height / 2))),
    (New-Point $adminOperationHeader.Right ($adminOperationHeader.Y + ($adminOperationHeader.Height / 2)))
)) $adminBorder 3 15
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1690 ($adminWarehouseHeader.Y + ($adminWarehouseHeader.Height / 2))),
    (New-Point $adminWarehouseHeader.Right ($adminWarehouseHeader.Y + ($adminWarehouseHeader.Height / 2)))
)) $adminBorder 3 15
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 30 ($adminSystemHeader.Y + ($adminSystemHeader.Height / 2))),
    (New-Point $adminSystemHeader.Left ($adminSystemHeader.Y + ($adminSystemHeader.Height / 2)))
)) $adminBorder 3 15

# Bus điều hướng Nhân viên: từ Trang chủ có thể chọn độc lập bất kỳ nhóm chức năng nào.
Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 2688 $employeeHomeRect.Bottom),
    (New-Point 2688 770),
    (New-Point 1818 770),
    (New-Point 3478 770)
)) $employeeBorder 3
Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1818 770),
    (New-Point 1818 1433)
)) $employeeBorder 3
Draw-Line $graphics ([System.Drawing.PointF[]]@(
    (New-Point 3478 770),
    (New-Point 3478 1403)
)) $employeeBorder 3

$employeeWorkHeader = Get-GroupHeaderRect $employeeWorkRect
$employeeOperationHeader = Get-GroupHeaderRect $employeeOperationRect
$employeeReportHeader = Get-GroupHeaderRect $employeeReportRect
$employeePersonalHeader = Get-GroupHeaderRect $employeePersonalRect
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1818 ($employeeWorkHeader.Y + ($employeeWorkHeader.Height / 2))),
    (New-Point $employeeWorkHeader.Left ($employeeWorkHeader.Y + ($employeeWorkHeader.Height / 2)))
)) $employeeBorder 3 15
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 3478 ($employeeOperationHeader.Y + ($employeeOperationHeader.Height / 2))),
    (New-Point $employeeOperationHeader.Right ($employeeOperationHeader.Y + ($employeeOperationHeader.Height / 2)))
)) $employeeBorder 3 15
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 1818 ($employeeReportHeader.Y + ($employeeReportHeader.Height / 2))),
    (New-Point $employeeReportHeader.Left ($employeeReportHeader.Y + ($employeeReportHeader.Height / 2)))
)) $employeeBorder 3 15
Draw-ArrowPolyline $graphics ([System.Drawing.PointF[]]@(
    (New-Point 3478 ($employeePersonalHeader.Y + ($employeePersonalHeader.Height / 2))),
    (New-Point $employeePersonalHeader.Right ($employeePersonalHeader.Y + ($employeePersonalHeader.Height / 2)))
)) $employeeBorder 3 15

# Vẽ các nút chính sau đường nối để đường không lấn vào chữ.
Draw-MainNode $graphics $loginRect 'ĐĂNG NHẬP' '' $authFill $authBorder $darkText
Draw-MainNode $graphics $roleDecisionRect 'XÁC ĐỊNH QUYỀN' '' $authFill $authBorder $darkText
Draw-MainNode $graphics $adminRoleRect 'ADMIN' '' $adminFill $adminBorder $darkText
Draw-MainNode $graphics $employeeRoleRect 'NHÂN VIÊN' '' $employeeFill $employeeBorder $darkText
Draw-MainNode $graphics $adminHomeRect 'Tổng quan' 'Màn hình đầu tiên sau đăng nhập' $adminFill $adminBorder $darkText
Draw-MainNode $graphics $employeeHomeRect 'Trang chủ' 'Màn hình đầu tiên sau đăng nhập' $employeeFill $employeeBorder $darkText

# Nội dung nhánh Admin.
Draw-GroupContents $graphics $adminHumanRect 'NHÓM NHÂN SỰ' @(
    'Nhân viên',
    'Đăng ký ca',
    'Lịch làm việc',
    'Chấm công',
    'Lương'
) $adminFill $adminNode $adminBorder $adminBorder

Draw-GroupContents $graphics $adminOperationRect 'NHÓM VẬN HÀNH' @(
    'Kiểm kho theo ca',
    'Báo cáo ca'
) $adminFill $adminNode $adminBorder $adminBorder

Draw-GroupContents $graphics $adminWarehouseRect 'NHÓM KHO HÀNG' @(
    'Tổng kho hàng',
    'Danh mục',
    'Nhà cung cấp'
) $adminFill $adminNode $adminBorder $adminBorder

Draw-GroupContents $graphics $adminSystemRect 'NHÓM HỆ THỐNG' @(
    'Chat nội bộ',
    'Báo cáo – thống kê',
    'Thông báo',
    'Cài đặt'
) $adminFill $adminNode $adminBorder $adminBorder

# Nội dung nhánh Nhân viên.
Draw-GroupContents $graphics $employeeWorkRect 'NHÓM CÔNG VIỆC' @(
    'Đăng ký ca',
    'Lịch làm',
    'Chấm công',
    'Lương của tôi'
) $employeeFill $employeeNode $employeeBorder $employeeBorder

Draw-GroupContents $graphics $employeeOperationRect 'NHÓM VẬN HÀNH CA' @(
    'Mở ca',
    "Kết ca /`nBáo cáo doanh thu",
    'Kiểm kho'
) $employeeFill $employeeNode $employeeBorder $employeeBorder

Draw-GroupContents $graphics $employeeReportRect 'NHÓM BÁO CÁO' @(
    'Báo cáo vệ sinh',
    'Báo cáo hàng hóa'
) $employeeFill $employeeNode $employeeBorder $employeeBorder

Draw-GroupContents $graphics $employeePersonalRect 'NHÓM CÁ NHÂN – LIÊN LẠC' @(
    'Chat nội bộ',
    'Thông báo',
    'Hồ sơ'
) $employeeFill $employeeNode $employeeBorder $employeeBorder

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$fontMain.Dispose()
$fontHome.Dispose()
$fontSubtitle.Dispose()
$fontGroup.Dispose()
$fontItem.Dispose()
$fontItemSmall.Dispose()

Write-Output $outputPath
