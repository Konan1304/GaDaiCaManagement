Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$outputDir = Join-Path (Get-Location) 'documents\chapter3_assets'
[System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
$outputPath = Join-Path $outputDir 'Hinh_3_11_Sequence_Dang_nhap.png'

$width = 3000
$height = 2100
$lifelineTop = 230
$lifelineBottom = 2020
$actorX = 280
$frontendX = 1040
$backendX = 1840
$databaseX = 2700

function New-Pen {
    param([string]$Color, [float]$Thickness = 2, [bool]$Dashed = $false)
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Color)), $Thickness
    if ($Dashed) { $pen.DashPattern = [float[]]@(10, 8) }
    return $pen
}

function Draw-ArrowHead {
    param($Graphics, [float]$X, [float]$Y, [bool]$PointsRight, [bool]$Open = $false)
    $direction = if ($PointsRight) { -1 } else { 1 }
    $tip = [System.Drawing.PointF]::new([float]$X, [float]$Y)
    $upper = [System.Drawing.PointF]::new([float]($X + ($direction * 18)), [float]($Y - 9))
    $lower = [System.Drawing.PointF]::new([float]($X + ($direction * 18)), [float]($Y + 9))
    if ($Open) {
        $pen = New-Pen '#222222' 2.5
        $Graphics.DrawLine($pen, $tip, $upper)
        $Graphics.DrawLine($pen, $tip, $lower)
        $pen.Dispose()
    } else {
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#222222'))
        $Graphics.FillPolygon($brush, [System.Drawing.PointF[]]@($tip, $upper, $lower))
        $brush.Dispose()
    }
}

function Draw-MessageLabel {
    param($Graphics, $Font, [string]$Text, [float]$Left, [float]$Right, [float]$Y, [float]$Height = 108)
    $x = [Math]::Min($Left, $Right) + 20
    $w = [Math]::Abs($Right - $Left) - 40
    $rect = [System.Drawing.RectangleF]::new([float]$x, [float]($Y - $Height - 8), [float]$w, [float]$Height)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#171717'))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Far
    $Graphics.FillRectangle($white, $rect)
    $Graphics.DrawString($Text, $Font, $ink, $rect, $format)
    $white.Dispose(); $ink.Dispose(); $format.Dispose()
}

function Draw-Message {
    param($Graphics, $Fonts, [float]$FromX, [float]$ToX, [float]$Y, [string]$Text, [bool]$Response = $false, [bool]$Compact = $false)
    $pen = New-Pen '#222222' 2.5 $Response
    $Graphics.DrawLine($pen, $FromX, $Y, $ToX, $Y)
    Draw-ArrowHead $Graphics $ToX $Y ($ToX -gt $FromX) $Response
    $labelFont = if ($Compact) { $Fonts.MessageSmall } else { $Fonts.Message }
    Draw-MessageLabel $Graphics $labelFont $Text $FromX $ToX $Y
    $pen.Dispose()
}

function Draw-SelfMessage {
    param($Graphics, $Fonts, [float]$X, [float]$Y, [string]$Text, [float]$LoopWidth = 215)
    $pen = New-Pen '#222222' 2.5
    $right = $X + $LoopWidth
    $bottom = $Y + 62
    $points = [System.Drawing.PointF[]]@(
        ([System.Drawing.PointF]::new([float]$X, [float]$Y)),
        ([System.Drawing.PointF]::new([float]$right, [float]$Y)),
        ([System.Drawing.PointF]::new([float]$right, [float]$bottom)),
        ([System.Drawing.PointF]::new([float]$X, [float]$bottom))
    )
    $Graphics.DrawLines($pen, $points)
    Draw-ArrowHead $Graphics $X $bottom $false $false
    $rect = [System.Drawing.RectangleF]::new([float]($X + 30), [float]($Y - 54), [float]($LoopWidth + 360), 48)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#171717'))
    $Graphics.FillRectangle($white, $rect)
    $Graphics.DrawString($Text, $Fonts.Message, $ink, $rect)
    $white.Dispose(); $ink.Dispose(); $pen.Dispose()
}

function Draw-Participant {
    param($Graphics, $Fonts, [float]$CenterX, [string]$Name, [float]$BoxWidth)
    $boxX = $CenterX - ($BoxWidth / 2)
    $box = [System.Drawing.RectangleF]::new([float]$boxX, 72, [float]$BoxWidth, 92)
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F4F4F4'))
    $border = New-Pen '#222222' 2.5
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#111111'))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $Graphics.FillRectangle($fill, $box)
    $Graphics.DrawRectangle($border, $box.X, $box.Y, $box.Width, $box.Height)
    $Graphics.DrawString($Name, $Fonts.Participant, $ink, $box, $format)
    $fill.Dispose(); $border.Dispose(); $ink.Dispose(); $format.Dispose()
}

function Draw-Actor {
    param($Graphics, $Fonts, [float]$CenterX)
    $pen = New-Pen '#222222' 3
    $Graphics.DrawEllipse($pen, $CenterX - 21, 48, 42, 42)
    $Graphics.DrawLine($pen, $CenterX, 90, $CenterX, 137)
    $Graphics.DrawLine($pen, $CenterX - 38, 109, $CenterX + 38, 109)
    $Graphics.DrawLine($pen, $CenterX, 137, $CenterX - 33, 169)
    $Graphics.DrawLine($pen, $CenterX, 137, $CenterX + 33, 169)
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#111111'))
    $rect = [System.Drawing.RectangleF]::new([float]($CenterX - 160), 168, 320, 80)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $Graphics.DrawString('Người dùng', $Fonts.Participant, $ink, $rect, $format)
    $pen.Dispose(); $ink.Dispose(); $format.Dispose()
}

function Draw-Activation {
    param($Graphics, [float]$X, [float]$Top, [float]$Bottom)
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#E9E9E9'))
    $border = New-Pen '#555555' 1.6
    $Graphics.FillRectangle($fill, $X - 12, $Top, 24, $Bottom - $Top)
    $Graphics.DrawRectangle($border, $X - 12, $Top, 24, $Bottom - $Top)
    $fill.Dispose(); $border.Dispose()
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::White)

$fonts = [PSCustomObject]@{
    Participant = New-Object System.Drawing.Font('Segoe UI', 27, [System.Drawing.FontStyle]::Bold)
    Message = New-Object System.Drawing.Font('Segoe UI', 23, [System.Drawing.FontStyle]::Regular)
    MessageSmall = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Regular)
    Guard = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)
    Alt = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)
}

Draw-Actor $graphics $fonts $actorX
Draw-Participant $graphics $fonts $frontendX 'Frontend ReactJS' 430
Draw-Participant $graphics $fonts $backendX 'Backend Node.js/ExpressJS' 520
Draw-Participant $graphics $fonts $databaseX 'Microsoft SQL Server' 450

$lifelinePen = New-Pen '#707070' 2 $true
foreach ($x in @($actorX, $frontendX, $backendX, $databaseX)) {
    $graphics.DrawLine($lifelinePen, $x, $lifelineTop, $x, $lifelineBottom)
}
$lifelinePen.Dispose()

# Activation bars được vẽ trước thông điệp để mũi tên luôn rõ ràng.
Draw-Activation $graphics $frontendX 340 1945
Draw-Activation $graphics $backendX 465 1675
Draw-Activation $graphics $databaseX 590 780

Draw-Message -Graphics $graphics -Fonts $fonts -FromX $actorX -ToX $frontendX -Y 365 -Text 'Nhập Email, Mật khẩu và chọn “Đăng nhập”' -Response $false
Draw-Message -Graphics $graphics -Fonts $fonts -FromX $frontendX -ToX $backendX -Y 500 -Text "POST /api/auth/login`n{ Email, Mật khẩu }" -Response $false
Draw-Message -Graphics $graphics -Fonts $fonts -FromX $backendX -ToX $databaseX -Y 635 -Text 'Tìm tài khoản theo Email' -Response $false
Draw-Message -Graphics $graphics -Fonts $fonts -FromX $databaseX -ToX $backendX -Y 765 -Text "Thông tin tài khoản, password_hash,`ntrạng thái và thông tin quyền" -Response $true
Draw-SelfMessage $graphics $fonts $backendX 840 'Kiểm tra mật khẩu bằng bcrypt' 235

# Combined Fragment: alt.
$altX = 105
$altY = 930
$altWidth = 2790
$altHeight = 1010
$altPen = New-Pen '#222222' 2.5
$graphics.DrawRectangle($altPen, $altX, $altY, $altWidth, $altHeight)
$tabPoints = [System.Drawing.PointF[]]@(
    ([System.Drawing.PointF]::new([float]$altX, [float]$altY)),
    ([System.Drawing.PointF]::new([float]($altX + 120), [float]$altY)),
    ([System.Drawing.PointF]::new([float]($altX + 148), [float]($altY + 37))),
    ([System.Drawing.PointF]::new([float]$altX, [float]($altY + 37)))
)
$tabBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F1F1F1'))
$graphics.FillPolygon($tabBrush, $tabPoints)
$graphics.DrawPolygon($altPen, $tabPoints)
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#111111'))
$graphics.DrawString('alt', $fonts.Alt, $ink, $altX + 18, $altY + 3)

$graphics.DrawString('[Đăng nhập không hợp lệ]', $fonts.Guard, $ink, $altX + 175, $altY + 18)
Draw-Message -Graphics $graphics -Fonts $fonts -FromX $backendX -ToX $frontendX -Y 1040 -Text 'Trả thông báo lỗi' -Response $true
Draw-Message -Graphics $graphics -Fonts $fonts -FromX $frontendX -ToX $actorX -Y 1175 -Text 'Hiển thị “Email hoặc mật khẩu không chính xác” hoặc tài khoản không hợp lệ' -Response $false -Compact $true

$dividerY = 1260
$dividerPen = New-Pen '#555555' 2 $true
$graphics.DrawLine($dividerPen, $altX, $dividerY, $altX + $altWidth, $dividerY)
$graphics.DrawString('[Đăng nhập hợp lệ]', $fonts.Guard, $ink, $altX + 28, $dividerY + 18)

Draw-SelfMessage $graphics $fonts $backendX 1370 'Tạo JWT Token' 205
Draw-SelfMessage $graphics $fonts $backendX 1480 'Xác định quyền: Admin hoặc Nhân viên' 235
Draw-Message -Graphics $graphics $fonts -FromX $backendX -ToX $frontendX -Y 1640 -Text 'JWT Token + thông tin người dùng + quyền' -Response $true
Draw-SelfMessage $graphics $fonts $frontendX 1710 'Lưu trạng thái đăng nhập' 210
Draw-Message -Graphics $graphics $fonts -FromX $frontendX -ToX $actorX -Y 1885 -Text "Admin → Trang Tổng quan`nNhân viên → Trang chủ Nhân viên" -Response $false

$dividerPen.Dispose(); $altPen.Dispose(); $tabBrush.Dispose(); $ink.Dispose()
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
$fonts.PSObject.Properties.Value | ForEach-Object { $_.Dispose() }
Write-Output $outputPath
