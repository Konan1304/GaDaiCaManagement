$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = "D:\DaiGaManagement\documents"
$assetDir = Join-Path $root "chapter3_assets"
$output = Join-Path $root "CHUONG_3_PHAN_TICH_VA_THIET_KE_HE_THONG.docx"

function New-Canvas([string]$path, [string]$title) {
    $bmp = New-Object Drawing.Bitmap 1800, 1000
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([Drawing.Color]::White)
    $fontTitle = New-Object Drawing.Font("Arial", 26, [Drawing.FontStyle]::Bold)
    $brush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(30,30,30))
    $g.DrawString($title, $fontTitle, $brush, 55, 35)
    return @{ Bitmap=$bmp; Graphics=$g; Path=$path; Objects=@($fontTitle,$brush) }
}

function Draw-Box($canvas, [int]$x, [int]$y, [int]$w, [int]$h, [string]$text, [string]$kind="normal") {
    $g=$canvas.Graphics
    $text=$text.Replace('\n',[Environment]::NewLine)
    $fill = switch($kind){"primary"{[Drawing.Color]::FromArgb(255,192,0)}"dark"{[Drawing.Color]::FromArgb(35,35,35)}"green"{[Drawing.Color]::FromArgb(226,247,236)}"blue"{[Drawing.Color]::FromArgb(232,239,255)}default{[Drawing.Color]::FromArgb(255,250,231)}}
    $textColor = if($kind -eq "dark"){[Drawing.Color]::White}else{[Drawing.Color]::FromArgb(25,25,25)}
    $brush=New-Object Drawing.SolidBrush($fill);$pen=New-Object Drawing.Pen([Drawing.Color]::FromArgb(196,162,63),2)
    $g.FillRectangle($brush,$x,$y,$w,$h);$g.DrawRectangle($pen,$x,$y,$w,$h)
    $font=New-Object Drawing.Font("Arial",16,[Drawing.FontStyle]::Bold);$tb=New-Object Drawing.SolidBrush($textColor)
    $format=New-Object Drawing.StringFormat;$format.Alignment=[Drawing.StringAlignment]::Center;$format.LineAlignment=[Drawing.StringAlignment]::Center
    $g.DrawString($text,$font,$tb,[Drawing.RectangleF]::new($x+8,$y+6,$w-16,$h-12),$format)
    $brush.Dispose();$pen.Dispose();$font.Dispose();$tb.Dispose();$format.Dispose()
}

function Draw-Arrow($canvas,[int]$x1,[int]$y1,[int]$x2,[int]$y2){
    $pen=New-Object Drawing.Pen([Drawing.Color]::FromArgb(90,90,90),3)
    $cap=New-Object Drawing.Drawing2D.AdjustableArrowCap(6,7);$pen.CustomEndCap=$cap
    $canvas.Graphics.DrawLine($pen,$x1,$y1,$x2,$y2);$cap.Dispose();$pen.Dispose()
}

function Save-Canvas($canvas){$canvas.Bitmap.Save($canvas.Path,[Drawing.Imaging.ImageFormat]::Png);$canvas.Graphics.Dispose();$canvas.Bitmap.Dispose();foreach($o in $canvas.Objects){$o.Dispose()}}

function Diagram-Context {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_1_so_do_ngu_canh.png") "SƠ ĐỒ NGỮ CẢNH HỆ THỐNG"
    Draw-Box $c 80 270 300 150 "QUẢN TRỊ VIÊN\nQuản lý và giám sát" "dark"
    Draw-Box $c 80 580 300 150 "NHÂN VIÊN\nThực hiện nghiệp vụ" "dark"
    Draw-Box $c 660 330 480 270 "WEBSITE QUẢN LÝ\nCỬA HÀNG GÀ ĐẠI CA" "primary"
    Draw-Box $c 1410 270 300 150 "DỮ LIỆU QUẢN LÝ\nBáo cáo, lịch, lương" "blue"
    Draw-Box $c 1410 580 300 150 "THÔNG TIN PHẢN HỒI\nThông báo, kết quả" "green"
    Draw-Arrow $c 380 345 660 410;Draw-Arrow $c 380 655 660 530;Draw-Arrow $c 1140 410 1410 345;Draw-Arrow $c 1410 655 1140 530
    Save-Canvas $c
}

function Diagram-Decomposition {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_2_phan_ra_chuc_nang.png") "SƠ ĐỒ PHÂN RÃ CHỨC NĂNG"
    Draw-Box $c 590 100 620 100 "HỆ THỐNG QUẢN LÝ GÀ ĐẠI CA" "primary"
    $labels=@("Xác thực & tài khoản","Nhân viên & chi nhánh","Đăng ký ca & lịch","Chấm công & lương","Vận hành ca","Kiểm kho theo ca","Tổng kho & nhập xuất","Danh mục & NCC","Báo cáo nội bộ","Chat & thông báo","Báo cáo thống kê","Cài đặt & nhật ký")
    for($i=0;$i -lt $labels.Count;$i++){$row=[math]::Floor($i/4);$col=$i%4;$x=70+$col*435;$y=300+$row*205;Draw-Box $c $x $y 365 105 $labels[$i] ($(if($row%2-eq0){"normal"}else{"blue"}));Draw-Arrow $c 900 200 ($x+182) $y}
    Save-Canvas $c
}

function Diagram-UseCase {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_3_use_case_tong_quat.png") "USE CASE TỔNG QUÁT"
    Draw-Box $c 55 250 250 150 "QUẢN TRỊ VIÊN" "dark";Draw-Box $c 55 610 250 150 "NHÂN VIÊN" "dark"
    $admin=@("Quản lý nhân viên","Tạo đợt & xếp lịch","Theo dõi chấm công","Quản lý lương","Quản lý kho","Duyệt báo cáo","Thống kê & cài đặt")
    $employee=@("Đăng ký ca","Xem lịch & lương","Chấm công","Mở/kết ca","Kiểm kho","Gửi báo cáo","Chat & thông báo")
    for($i=0;$i -lt 7;$i++){Draw-Box $c (410+($i%4)*335) (170+[math]::Floor($i/4)*145) 285 90 $admin[$i] "normal";Draw-Box $c (410+($i%4)*335) (545+[math]::Floor($i/4)*145) 285 90 $employee[$i] "green"}
    Draw-Arrow $c 305 325 410 260;Draw-Arrow $c 305 685 410 635
    Save-Canvas $c
}

function Diagram-Processes {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_4_quy_trinh_nghiep_vu.png") "BA QUY TRÌNH NGHIỆP VỤ CHÍNH"
    $flows=@(
      @{Y=190;Name="NHÂN SỰ";Kind="blue";Steps=@("Đăng ký ca","Xếp lịch","Công bố lịch","Chấm công","Tổng hợp giờ","Tính lương")},
      @{Y=455;Name="VẬN HÀNH";Kind="normal";Steps=@("Kiểm tra lịch","Mở ca","Ghi doanh thu","Đếm tiền","Gửi báo cáo","Kết ca")},
      @{Y=720;Name="KHO";Kind="green";Steps=@("Nhận tồn đầu","Nhập / Xuất","Kiểm đếm","Tính tồn cuối","Bàn giao","Đối chiếu")}
    )
    foreach($flow in $flows){Draw-Box $c 45 $flow.Y 200 100 $flow.Name "dark";for($i=0;$i-lt 6;$i++){$x=300+$i*245;Draw-Box $c $x $flow.Y 190 100 $flow.Steps[$i] $flow.Kind;if($i-lt 5){Draw-Arrow $c ($x+190) ($flow.Y+50) ($x+245) ($flow.Y+50)}}}
    Save-Canvas $c
}

function Diagram-Architecture {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_5_kien_truc.png") "KIẾN TRÚC HỆ THỐNG"
    $labels=@("NGƯỜI DÙNG\nTrình duyệt Web","FRONTEND\nReactJS + Vite","REST API\nHTTP/JSON + JWT","BACKEND\nNode.js + ExpressJS","CƠ SỞ DỮ LIỆU\nMicrosoft SQL Server")
    $kinds=@("dark","primary","blue","normal","green")
    for($i=0;$i-lt $labels.Count;$i++){$x=60+$i*345;Draw-Box $c $x 330 285 190 $labels[$i] $kinds[$i];if($i-lt 4){Draw-Arrow $c ($x+285) 425 ($x+345) 425}}
    Draw-Box $c 575 690 300 125 "KHO ẢNH / TỆP\nUpload có kiểm soát" "normal";Draw-Arrow $c 1250 520 875 750
    Save-Canvas $c
}

function Diagram-ERD {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_6_erd_logic.png") "MÔ HÌNH DỮ LIỆU LOGIC THEO NHÓM"
    Draw-Box $c 650 390 500 150 "NHÂN VIÊN – CHI NHÁNH\nusers · roles · employees · branches" "primary"
    $nodes=@(
      @{X=55;Y=155;T="LỊCH LÀM\nperiods · registrations\nschedules · shifts"},
      @{X=55;Y=690;T="CHẤM CÔNG – LƯƠNG\nattendance_logs · payrolls"},
      @{X=690;Y=110;T="VẬN HÀNH CA\nshift_sessions · reports\nexpenses · cash_counts"},
      @{X=1300;Y=155;T="KHO HÀNG\nproducts · inventories\ntransactions · counts"},
      @{X=1300;Y=690;T="NHÀ CUNG CẤP\nsuppliers · purchase_orders\npurchase_receipts"},
      @{X=690;Y=735;T="HỆ THỐNG\nchat · notifications\nbranch_reports · audit_logs"}
    )
    foreach($n in $nodes){Draw-Box $c $n.X $n.Y 430 150 $n.T "blue";Draw-Arrow $c ($n.X+215) ($n.Y+75) 900 465}
    Save-Canvas $c
}

function Diagram-Navigation {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_7_dieu_huong.png") "SƠ ĐỒ ĐIỀU HƯỚNG THEO VAI TRÒ"
    Draw-Box $c 675 90 450 90 "ĐĂNG NHẬP → XÁC ĐỊNH QUYỀN" "primary"
    Draw-Box $c 180 250 500 100 "QUẢN TRỊ VIÊN" "dark";Draw-Box $c 1120 250 500 100 "NHÂN VIÊN" "dark"
    Draw-Arrow $c 900 180 430 250;Draw-Arrow $c 900 180 1370 250
    Draw-Box $c 80 430 700 390 "Tổng quan · Nhân viên · Đăng ký ca\nLịch làm · Chấm công · Lương\nKiểm kho · Tổng kho · Danh mục\nNhà cung cấp · Báo cáo ca\nChat · Thống kê · Thông báo · Cài đặt" "normal"
    Draw-Box $c 1020 430 700 390 "Trang chủ · Đăng ký lịch · Lịch làm\nChấm công · Lương của tôi\nMở ca · Báo cáo doanh thu · Kết ca\nKiểm kho · Báo cáo vệ sinh/hàng hóa\nChat · Thông báo · Hồ sơ" "green"
    Draw-Arrow $c 430 350 430 430;Draw-Arrow $c 1370 350 1370 430
    Save-Canvas $c
}

function Diagram-Sequence {
    $c=New-Canvas (Join-Path $assetDir "hinh_3_8_sequence_dang_nhap.png") "SEQUENCE DIAGRAM – ĐĂNG NHẬP"
    $xs=@(160,600,1050,1500);$names=@("NGƯỜI DÙNG","REACTJS","EXPRESS API","SQL SERVER")
    for($i=0;$i-lt 4;$i++){Draw-Box $c ($xs[$i]-120) 120 240 75 $names[$i] ($(if($i-eq0){"dark"}else{"normal"}));$pen=New-Object Drawing.Pen([Drawing.Color]::Gray,2);$pen.DashStyle=[Drawing.Drawing2D.DashStyle]::Dash;$c.Graphics.DrawLine($pen,$xs[$i],195,$xs[$i],900);$pen.Dispose()}
    $events=@(
      @{A=0;B=1;Y=275;T="1. Nhập tài khoản, mật khẩu"},@{A=1;B=2;Y=380;T="2. POST /api/auth/login"},
      @{A=2;B=3;Y=485;T="3. Truy vấn tài khoản và quyền"},@{A=3;B=2;Y=590;T="4. Trả dữ liệu người dùng"},
      @{A=2;B=1;Y=695;T="5. Kiểm tra bcrypt, tạo JWT"},@{A=1;B=0;Y=800;T="6. Lưu phiên, chuyển trang theo quyền"}
    )
    foreach($e in $events){Draw-Arrow $c $xs[$e.A] $e.Y $xs[$e.B] $e.Y;$font=New-Object Drawing.Font("Arial",13);$brush=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(50,50,50));$left=[math]::Min($xs[$e.A],$xs[$e.B]);$c.Graphics.DrawString($e.T,$font,$brush,$left+15,$e.Y-28);$font.Dispose();$brush.Dispose()}
    Save-Canvas $c
}

Diagram-Context;Diagram-Decomposition;Diagram-UseCase;Diagram-Processes;Diagram-Architecture;Diagram-ERD;Diagram-Navigation;Diagram-Sequence

$body = New-Object System.Collections.Generic.List[string]
$imageRelationships = New-Object System.Collections.Generic.List[string]
$images = New-Object System.Collections.Generic.List[object]
$imageIndex = 0
function Xml([string]$value){[Security.SecurityElement]::Escape($value)}
function Add-Paragraph([string]$text="",[string]$style="Normal",[int]$align=3,[switch]$bold,[switch]$italic) {
    $styleId=$style-replace ' ','';$jc=switch($align){1{'center'}2{'right'}3{'both'}default{'left'}};$props="<w:pStyle w:val=`"$styleId`"/><w:jc w:val=`"$jc`"/><w:spacing w:after=`"120`"/>";$run="<w:rFonts w:ascii=`"Times New Roman`" w:hAnsi=`"Times New Roman`"/><w:sz w:val=`"26`"/>";if($bold){$run+='<w:b/>'};if($italic){$run+='<w:i/>'};$body.Add("<w:p><w:pPr>$props</w:pPr><w:r><w:rPr>$run</w:rPr><w:t xml:space=`"preserve`">$(Xml $text)</w:t></w:r></w:p>")
}
function Add-Heading([string]$text,[int]$level){Add-Paragraph $text "Heading $level" 0}
function Add-Bullets([string[]]$items){foreach($item in $items){$body.Add("<w:p><w:pPr><w:ind w:left=`"720`" w:hanging=`"300`"/><w:jc w:val=`"both`"/><w:spacing w:after=`"60`"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=`"Times New Roman`" w:hAnsi=`"Times New Roman`"/><w:sz w:val=`"26`"/></w:rPr><w:t>• $(Xml $item)</w:t></w:r></w:p>")}}
function Add-Numbered([string[]]$items){$number=1;foreach($item in $items){$body.Add("<w:p><w:pPr><w:ind w:left=`"720`" w:hanging=`"360`"/><w:jc w:val=`"both`"/><w:spacing w:after=`"60`"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=`"Times New Roman`" w:hAnsi=`"Times New Roman`"/><w:sz w:val=`"26`"/></w:rPr><w:t>$number. $(Xml $item)</w:t></w:r></w:p>");$number++}}
function Add-Table([string[]]$headers,[object[]]$rows,[double[]]$widths=$null){
    $borders='<w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders>'
    $xml='<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'+$borders+'</w:tblPr><w:tr>'
    foreach($header in $headers){$xml+='<w:tc><w:tcPr><w:shd w:fill="FFC000"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t>'+$(Xml $header)+'</w:t></w:r></w:p></w:tc>'};$xml+='</w:tr>'
    foreach($row in $rows){$xml+='<w:tr>';for($c=0;$c-lt $headers.Count;$c++){$xml+='<w:tc><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t>'+$(Xml ([string]$row[$c]))+'</w:t></w:r></w:p></w:tc>'};$xml+='</w:tr>'};$xml+='</w:tbl><w:p/>';$body.Add($xml)
}
function Add-Figure([string]$file,[string]$caption){$id=(Get-Variable imageIndex -Scope 1).Value+1;Set-Variable imageIndex $id -Scope 1;$rid="rId$id";$name="image$id.png";$images.Add(@($file,$name));$imageRelationships.Add("<Relationship Id=`"$rid`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image`" Target=`"media/$name`"/>");$body.Add("<w:p><w:pPr><w:jc w:val=`"center`"/></w:pPr><w:r><w:drawing><wp:inline distT=`"0`" distB=`"0`" distL=`"0`" distR=`"0`"><wp:extent cx=`"5943600`" cy=`"3302000`"/><wp:docPr id=`"$id`" name=`"Hinh $id`"/><a:graphic><a:graphicData uri=`"http://schemas.openxmlformats.org/drawingml/2006/picture`"><pic:pic><pic:nvPicPr><pic:cNvPr id=`"$id`" name=`"$name`"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=`"$rid`"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=`"0`" y=`"0`"/><a:ext cx=`"5943600`" cy=`"3302000`"/></a:xfrm><a:prstGeom prst=`"rect`"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>");Add-Paragraph $caption "Caption" 1 -Italic}
function Add-Note([string]$title,[string]$noteBody){$body.Add("<w:tbl><w:tblPr><w:tblW w:w=`"0`" w:type=`"auto`"/><w:tblBorders><w:top w:val=`"single`" w:sz=`"6`" w:color=`"D6B656`"/><w:left w:val=`"single`" w:sz=`"6`" w:color=`"D6B656`"/><w:bottom w:val=`"single`" w:sz=`"6`" w:color=`"D6B656`"/><w:right w:val=`"single`" w:sz=`"6`" w:color=`"D6B656`"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr><w:shd w:fill=`"FFF2CC`"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii=`"Times New Roman`" w:hAnsi=`"Times New Roman`"/><w:sz w:val=`"22`"/></w:rPr><w:t>$(Xml $title)</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:pPr><w:jc w:val=`"both`"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=`"Times New Roman`" w:hAnsi=`"Times New Roman`"/><w:sz w:val=`"22`"/></w:rPr><w:t>$(Xml $noteBody)</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p/>")}
function Add-PageBreak{$body.Add('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')}

Add-Paragraph "CHƯƠNG 3" "Title" 1 -Bold
Add-Paragraph "PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG" "Title" 1 -Bold
Add-Paragraph "Đề tài: Thiết kế và xây dựng Website quản lý cửa hàng thức ăn nhanh" "Subtitle" 1
Add-Paragraph "Sinh viên: Lê Văn Thái Dương – MSSV: 2400001414" "Subtitle" 1
Add-Paragraph "Tài liệu được xây dựng dựa trên mã nguồn thực tế của hệ thống Gà Đại Ca" "Subtitle" 1 -Italic
Add-PageBreak

Add-Heading "CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG" 1
Add-Paragraph "Chương này trình bày quá trình phân tích yêu cầu và thiết kế Website quản lý cửa hàng thức ăn nhanh Gà Đại Ca. Nội dung được xây dựng từ các quy trình nghiệp vụ thực tế gồm quản lý nhân sự, đăng ký ca, lịch làm việc, chấm công, tiền lương, vận hành ca, báo cáo doanh thu, kiểm kho, quản lý tổng kho, nhà cung cấp, trao đổi nội bộ và báo cáo thống kê. Kết quả phân tích là cơ sở để tổ chức kiến trúc phần mềm, thiết kế cơ sở dữ liệu, API và giao diện được trình bày ở Chương 4."

Add-Heading "3.1. Phân tích yêu cầu hệ thống" 2
Add-Heading "3.1.1. Mô tả bài toán" 3
Add-Paragraph "Hoạt động của chuỗi cửa hàng thức ăn nhanh có sự tham gia của nhiều nhân viên, nhiều ca làm và nhiều chi nhánh. Mỗi ngày, quản lý phải thực hiện đồng thời các công việc như tiếp nhận đăng ký ca, xếp lịch, theo dõi chấm công, tính lương, kiểm soát doanh thu, kiểm kho và tiếp nhận báo cáo từ nhân viên. Khi quy mô tăng, việc theo dõi bằng sổ giấy và bảng tính riêng lẻ khiến thông tin bị phân tán và khó đối chiếu."
Add-Paragraph "Đối với công tác nhân sự, lịch đăng ký có thể thay đổi theo tuần, nhân viên làm theo nhiều khung giờ và mức lương khác nhau. Nếu lịch làm, dữ liệu chấm công và bảng lương không được liên kết, quản lý phải tổng hợp thủ công, dễ xảy ra nhầm lẫn số giờ, đi trễ, về sớm hoặc thiếu giờ ra. Nhân viên cũng khó chủ động kiểm tra lịch và thu nhập của mình."
Add-Paragraph "Đối với hoạt động cửa hàng, doanh thu được hình thành từ nhiều kênh như tiền mặt, Grab, ShopeeFood, Be, MPOS và Xanh SM. Cuối mỗi ca cần đếm tiền, ghi nhận chi phí, tính chênh lệch quỹ và bàn giao cho ca sau. Song song đó, số lượng nguyên liệu phải được kiểm đếm, đối chiếu với tồn hệ thống và các phiếu nhập – xuất. Nếu các nghiệp vụ không được lưu tập trung thì việc truy vết chênh lệch sẽ mất nhiều thời gian."
Add-Paragraph "Từ thực trạng trên, đề tài xây dựng một website quản lý tập trung gồm giao diện quản trị viên và giao diện nhân viên. Hệ thống hỗ trợ dữ liệu theo chi nhánh, phân quyền theo vai trò và liên kết các quy trình từ đăng ký ca đến chấm công, tính lương, báo cáo doanh thu và kiểm kho. Dữ liệu được lưu trong SQL Server và truy cập thông qua RESTful API."

Add-Heading "3.1.2. Mục tiêu xây dựng hệ thống" 3
Add-Bullets @("Tập trung dữ liệu nhân viên, lịch làm việc, chấm công, lương, doanh thu và kho hàng trong cùng một hệ thống.","Giảm thao tác tổng hợp thủ công và tăng khả năng đối chiếu giữa các nghiệp vụ.","Hỗ trợ quản trị viên theo dõi dữ liệu theo ngày, tháng, năm và theo từng chi nhánh.","Cho phép nhân viên chủ động đăng ký ca, xem lịch, chấm công và lập các báo cáo được phân công.","Cung cấp lịch sử, nhật ký và trạng thái xử lý để tăng tính minh bạch.","Xây dựng kiến trúc có khả năng bảo trì và mở rộng thêm chi nhánh hoặc loại nghiệp vụ.")

Add-Heading "3.1.3. Phạm vi hệ thống" 3
Add-Paragraph "Trong phạm vi đề tài, hệ thống quản lý dữ liệu nội bộ của cửa hàng và không thay thế hoàn toàn phần mềm bán hàng tại quầy. Dữ liệu doanh thu được nhân viên tổng hợp và gửi theo ca; dữ liệu đơn hàng từ các nền tảng giao hàng chưa được đồng bộ tự động."
Add-Bullets @("Quản lý người dùng, nhân viên, chức vụ và chi nhánh.","Quản lý đợt đăng ký ca, lịch làm việc, chấm công và bảng lương.","Quản lý mở ca, báo cáo doanh thu, đếm tiền, chi phí và kết ca.","Kiểm kho theo ca, bàn giao và xử lý chênh lệch.","Quản lý sản phẩm, danh mục, nhà cung cấp, phiếu nhập và phiếu xuất.","Chat nội bộ, thông báo, báo cáo vệ sinh và báo cáo hàng hóa.","Thống kê doanh thu và cấu hình hệ thống.")
Add-Note "Giới hạn của phiên bản đồ án" "Hệ thống chưa tích hợp trực tiếp POS, ngân hàng hoặc API của Grab, Be và ShopeeFood. Việc triển khai VPS, tên miền, HTTPS, sao lưu tự động và lưu ảnh trên cloud được xác định là hướng phát triển sau khi hoàn thiện bản thử nghiệm."

Add-Heading "3.1.4. Đối tượng sử dụng" 3
Add-Paragraph "Hệ thống có hai nhóm người dùng chính. Nhóm Quản trị viên bao gồm tài khoản Admin và Manager trong mã nguồn. Admin có thể xem toàn hệ thống; Manager thực hiện nghiệp vụ trong phạm vi chi nhánh được giao. Nhóm Nhân viên sử dụng giao diện riêng để thực hiện công việc cá nhân và nghiệp vụ ca."
Add-Table @("Đối tượng","Vai trò","Phạm vi dữ liệu") @(
 @("Admin","Quản trị cao nhất; quản lý chi nhánh, nhân sự, báo cáo và cấu hình.","Toàn bộ hệ thống"),
 @("Manager","Quản lý nhân viên, lịch, chấm công, lương, kho và báo cáo.","Chi nhánh được phân công"),
 @("Nhân viên","Đăng ký lịch, chấm công, xem lương, vận hành ca và gửi báo cáo.","Dữ liệu cá nhân và chi nhánh đang làm việc")
)

Add-Heading "3.1.5. Ma trận phân quyền" 3
Add-Table @("Chức năng","Admin","Manager","Nhân viên") @(
 @("Quản lý chi nhánh","Toàn quyền","Xem chi nhánh được giao","Không"),@("Quản lý nhân viên","Có","Theo chi nhánh","Không"),
 @("Tạo đợt đăng ký và xếp lịch","Có","Theo chi nhánh","Chỉ đăng ký"),@("Theo dõi chấm công","Có","Theo chi nhánh","Chỉ cá nhân"),
 @("Quản lý bảng lương","Có","Theo chi nhánh","Chỉ xem cá nhân"),@("Mở ca và gửi báo cáo doanh thu","Giám sát","Giám sát/Thực hiện","Thực hiện khi đủ điều kiện"),
 @("Kiểm kho theo ca","Giám sát, xử lý","Giám sát, xử lý","Kiểm đếm và bàn giao"),@("Quản lý tổng kho","Có","Theo chi nhánh","Hạn chế theo nghiệp vụ"),
 @("Báo cáo vệ sinh/hàng hóa","Xem và duyệt","Xem và duyệt","Tạo và gửi"),@("Chat và thông báo","Có","Có","Có"),
 @("Cài đặt và nhật ký","Có","Theo quyền","Không")
)

Add-Heading "3.1.6. Yêu cầu chức năng" 3
$functional=@(
 @("a. Xác thực và tài khoản","Đăng nhập, đăng xuất, xác định vai trò, điều hướng theo quyền, yêu cầu đặt lại mật khẩu, quản lý trạng thái tài khoản và phiên đăng nhập."),
 @("b. Nhân viên và chi nhánh","Thêm, cập nhật, khóa hoặc cho nghỉ việc; quản lý mã nhân viên, chức vụ, lương giờ, CCCD, ngân hàng, tài khoản và ảnh đại diện."),
 @("c. Đăng ký ca và lịch làm việc","Tạo đợt theo tuần, mở/đóng đăng ký, tiếp nhận lựa chọn của nhân viên, xếp lịch, lưu nháp và công bố lịch."),
 @("d. Chấm công và tiền lương","Chấm công vào/ra theo lịch, phát hiện đi trễ/về sớm/thiếu giờ ra, điều chỉnh có kiểm soát, tổng hợp giờ và tính lương tháng."),
 @("e. Vận hành và báo cáo ca","Kiểm tra điều kiện, mở ca, ghi tiền đầu ca, doanh thu theo kênh, chi phí, đếm tiền, tính chênh lệch, gửi báo cáo và khóa/mở lại ca."),
 @("f. Kiểm kho theo ca","Khởi tạo tồn đầu, ghi nhận sử dụng, nhận hàng, kiểm đếm tồn cuối, bàn giao giữa ca, phát hiện và xử lý chênh lệch."),
 @("g. Tổng kho và nhập – xuất","Theo dõi tồn đầu, nhập, xuất, tồn cuối; tra cứu lịch sử; lập phiếu nhập/xuất và cập nhật tồn kho sau xác nhận."),
 @("h. Sản phẩm, danh mục và nhà cung cấp","Quản lý nguyên liệu, đơn vị tính, giá vốn, mức tồn tối thiểu, danh mục, nhà cung cấp, đơn đặt hàng và chứng từ nhập."),
 @("i. Báo cáo vệ sinh và hàng hóa","Nhân viên lập báo cáo kèm ảnh; quản trị viên lọc theo chi nhánh, duyệt, yêu cầu xử lý và xuất Excel/PDF."),
 @("j. Chat và thông báo","Trao đổi theo chi nhánh và kênh nội dung; hỗ trợ nội dung nhiều dòng, tệp đính kèm, trạng thái đã đọc và thời gian Việt Nam."),
 @("k. Báo cáo thống kê và cài đặt","Tổng hợp doanh thu theo ngày/tháng/năm, so sánh chi nhánh, cấu hình thông tin cửa hàng và xem nhật ký quản trị.")
)
Add-Table @("Nhóm chức năng","Mô tả yêu cầu") $functional

Add-Heading "3.1.7. Yêu cầu phi chức năng" 3
Add-Table @("Yêu cầu","Nội dung") @(
 @("Dễ sử dụng","Giao diện tiếng Việt, bố cục nhất quán, thao tác rõ ràng và thích ứng với màn hình máy tính hoặc điện thoại."),
 @("Bảo mật","Mật khẩu được băm; API xác thực JWT; kiểm tra quyền, chi nhánh và loại tệp tải lên."),
 @("Chính xác","Công thức doanh thu, tồn kho, giờ công và lương phải nhất quán giữa backend, database và giao diện."),
 @("Hiệu năng","Danh sách lớn có tìm kiếm, lọc, phân trang; truy vấn báo cáo giới hạn theo thời gian và phạm vi."),
 @("Ổn định","Thông báo lỗi rõ ràng; tránh ghi dữ liệu một phần; sử dụng transaction với nghiệp vụ nhiều bước."),
 @("Tương thích","Hoạt động trên trình duyệt hiện đại, hỗ trợ độ phân giải khác nhau."),
 @("Bảo trì","Tách frontend, backend, route, controller, middleware và database migration."),
 @("Mở rộng","Có thể bổ sung chi nhánh, kênh doanh thu, loại báo cáo, WebSocket và lưu trữ cloud.")
)

Add-Heading "3.1.8. Quy tắc nghiệp vụ" 3
Add-Numbered @("Nhân viên chỉ được truy cập dữ liệu cá nhân và dữ liệu nghiệp vụ thuộc chi nhánh của mình.","Manager chỉ thao tác trong chi nhánh được phân công; Admin có quyền xem toàn hệ thống.","Nhân viên chỉ đăng ký ca khi đợt đăng ký đang mở và mỗi ngày chỉ chọn một mã ca hợp lệ.","Lịch chỉ có hiệu lực đối với nhân viên sau khi quản trị viên công bố.","Chấm công phải gắn với lịch làm việc và ngày nghiệp vụ tương ứng.","Việc mở ca yêu cầu nhân viên, lịch, chấm công và phân công ca đáp ứng điều kiện hệ thống.","Báo cáo doanh thu chỉ được đưa vào thống kê khi trạng thái đã gửi.","Tổng doanh thu bằng tổng doanh thu của các kênh thanh toán được khai báo.","Chênh lệch quỹ được xác định từ số tiền thực đếm và số tiền hệ thống dự kiến.","Tồn cuối phải được đối chiếu với tồn hệ thống và số bàn giao giữa hai ca.","Báo cáo vệ sinh và hàng hóa của nhân viên được tự động gắn với chi nhánh hiện tại.","Tất cả ngày giờ nghiệp vụ hiển thị theo múi giờ Việt Nam và định dạng ngày/tháng/năm.","Thao tác quản trị quan trọng phải có lịch sử hoặc nhật ký để phục vụ truy vết.")

Add-Heading "3.2. Phân tích hệ thống" 2
Add-Heading "3.2.1. Sơ đồ ngữ cảnh" 3
Add-Paragraph "Sơ đồ ngữ cảnh xác định ranh giới của website và những luồng thông tin chính giữa hệ thống với người sử dụng. Quản trị viên cung cấp dữ liệu cấu hình, lịch, nhân sự và quyết định duyệt; nhân viên cung cấp dữ liệu chấm công, báo cáo ca và kiểm kho. Hệ thống trả về lịch làm việc, lương, trạng thái xử lý, thống kê và thông báo."
Add-Figure (Join-Path $assetDir "hinh_3_1_so_do_ngu_canh.png") "Hình 3.1. Sơ đồ ngữ cảnh của hệ thống"

Add-Heading "3.2.2. Sơ đồ phân rã chức năng" 3
Add-Paragraph "Chức năng hệ thống được phân rã thành các nhóm có dữ liệu và trách nhiệm tương đối độc lập. Cách phân nhóm này tương ứng với cấu trúc route, controller và trang giao diện của mã nguồn, giúp việc phát triển và bảo trì thuận lợi hơn."
Add-Figure (Join-Path $assetDir "hinh_3_2_phan_ra_chuc_nang.png") "Hình 3.2. Sơ đồ phân rã chức năng"

Add-Heading "3.2.3. Sơ đồ Use Case tổng quát" 3
Add-Paragraph "Use Case tổng quát mô tả hai nhóm tác nhân chính và các dịch vụ họ nhận được từ hệ thống. Những chức năng dùng chung như đăng nhập, thông báo và chat được bảo vệ bằng xác thực; các chức năng quản trị tiếp tục được kiểm tra vai trò ở backend."
Add-Figure (Join-Path $assetDir "hinh_3_3_use_case_tong_quat.png") "Hình 3.3. Sơ đồ Use Case tổng quát"

Add-Heading "3.2.4. Phân tích Use Case theo tác nhân" 3
Add-Table @("Tác nhân","Use Case chính") @(
 @("Quản trị viên","Quản lý nhân viên và chi nhánh; tạo đợt đăng ký; xếp lịch; theo dõi chấm công và lương; giám sát ca; xử lý chênh lệch; quản lý kho; duyệt báo cáo; thống kê; cấu hình."),
 @("Nhân viên","Đăng ký ca; xem lịch và lương; chấm công; mở/kết ca; lập báo cáo doanh thu; kiểm kho và bàn giao; báo cáo vệ sinh/hàng hóa; chat; xem thông báo và hồ sơ.")
)

Add-Heading "3.2.5. Đặc tả các Use Case chính" 3
$ucs=@(
 @{N="3.2.5.1. Use Case đăng nhập";R=@(@("Mã","UC01"),@("Tác nhân","Quản trị viên, Nhân viên"),@("Tiền điều kiện","Tài khoản tồn tại và đang hoạt động."),@("Luồng chính","Nhập thông tin → Frontend gửi API → Backend tìm tài khoản → kiểm tra bcrypt → tạo JWT → trả vai trò → chuyển trang."),@("Ngoại lệ","Thiếu thông tin, sai mật khẩu, tài khoản bị khóa hoặc vượt giới hạn đăng nhập sai."),@("Kết quả","Người dùng có phiên hợp lệ và truy cập đúng giao diện vai trò."))},
 @{N="3.2.5.2. Use Case quản lý nhân viên";R=@(@("Mã","UC02"),@("Tác nhân","Admin, Manager"),@("Tiền điều kiện","Đã đăng nhập và có quyền quản lý nhân sự."),@("Luồng chính","Chọn chi nhánh → tìm nhân viên → thêm/xem/sửa → kiểm tra dữ liệu → lưu database → tải lại danh sách."),@("Ngoại lệ","Trùng mã, trùng tài khoản, thiếu trường bắt buộc hoặc cố truy cập khác chi nhánh."),@("Kết quả","Thông tin nhân viên và tài khoản được cập nhật nhất quán."))},
 @{N="3.2.5.3. Use Case đăng ký và xếp lịch";R=@(@("Mã","UC03"),@("Tác nhân","Quản trị viên, Nhân viên"),@("Tiền điều kiện","Có đợt đăng ký hợp lệ cho tuần và chi nhánh."),@("Luồng chính","Quản trị viên tạo/mở đợt → nhân viên chọn ca → quản trị viên xem tổng hợp → xếp lịch → lưu nháp → công bố."),@("Ngoại lệ","Đợt đã đóng, chọn nhiều ca trong một ngày, lịch trùng hoặc nhân viên không thuộc chi nhánh."),@("Kết quả","Lịch chính thức được công bố và hiển thị cho nhân viên."))},
 @{N="3.2.5.4. Use Case chấm công";R=@(@("Mã","UC04"),@("Tác nhân","Nhân viên, Quản trị viên"),@("Tiền điều kiện","Nhân viên có lịch làm hợp lệ trong ngày."),@("Luồng chính","Mở trang chấm công → hệ thống tìm lịch → chấm vào → ghi thời gian → chấm ra → tính trạng thái và số giờ."),@("Ngoại lệ","Không có lịch, chấm lặp, chấm ra trước chấm vào hoặc phiên không hợp lệ."),@("Kết quả","Bản ghi chấm công được tạo/cập nhật và dùng cho bảng lương."))},
 @{N="3.2.5.5. Use Case tính và xem lương";R=@(@("Mã","UC05"),@("Tác nhân","Quản trị viên, Nhân viên"),@("Tiền điều kiện","Có mức lương giờ và dữ liệu chấm công trong kỳ."),@("Luồng chính","Chọn tháng → tổng hợp giờ hợp lệ → áp dụng mức lương → tính tổng → quản trị viên kiểm tra/lưu → nhân viên xem."),@("Ngoại lệ","Thiếu mức lương, thiếu giờ ra hoặc dữ liệu chấm công chưa được xử lý."),@("Kết quả","Bảng lương tháng và chi tiết ngày công được lưu."))},
 @{N="3.2.5.6. Use Case vận hành và báo cáo ca";R=@(@("Mã","UC06"),@("Tác nhân","Nhân viên, Quản trị viên"),@("Tiền điều kiện","Nhân viên đủ điều kiện mở ca và chưa có ca trùng."),@("Luồng chính","Mở ca → nhập quỹ đầu → làm việc → khai báo doanh thu/chi phí → đếm tiền → tải ảnh → gửi báo cáo → khóa ca."),@("Ngoại lệ","Thiếu lịch/chấm công, số liệu âm, tổng kênh không hợp lệ hoặc thiếu ảnh bắt buộc."),@("Kết quả","Ca được kết thúc; báo cáo được đưa vào thống kê doanh thu."))},
 @{N="3.2.5.7. Use Case kiểm kho và bàn giao";R=@(@("Mã","UC07"),@("Tác nhân","Nhân viên, Quản trị viên"),@("Tiền điều kiện","Có phiên kiểm kho thuộc ca và chi nhánh."),@("Luồng chính","Nhận tồn đầu → ghi nhập/xuất/sử dụng → kiểm đếm → tải ảnh → đóng sổ → bàn giao → ca sau tiếp nhận."),@("Ngoại lệ","Số lượng không hợp lệ, có chênh lệch hoặc nhân viên không có quyền trên phiên."),@("Kết quả","Tồn cuối, số bàn giao và chênh lệch được lưu để quản trị viên xử lý."))},
 @{N="3.2.5.8. Use Case quản lý nhập – xuất kho";R=@(@("Mã","UC08"),@("Tác nhân","Quản trị viên, Nhân viên được giao nhận hàng"),@("Tiền điều kiện","Sản phẩm, đơn vị tính và chi nhánh tồn tại."),@("Luồng chính","Tạo phiếu → chọn nhà cung cấp/sản phẩm → nhập số lượng → đính kèm chứng từ → xác nhận → tạo giao dịch kho."),@("Ngoại lệ","Sản phẩm không hợp lệ, số lượng bằng không, chứng từ thiếu hoặc xuất vượt tồn cho phép."),@("Kết quả","Phiếu và giao dịch được lưu; tồn kho được cập nhật."))}
)
foreach($uc in $ucs){Add-Heading $uc.N 3;Add-Table @("Nội dung","Mô tả") $uc.R}

Add-Heading "3.2.6. Phân tích quy trình nghiệp vụ" 3
Add-Paragraph "Ba chuỗi nghiệp vụ quan trọng có quan hệ dữ liệu xuyên suốt. Quy trình nhân sự tạo nguồn dữ liệu cho chấm công và lương; quy trình vận hành tạo dữ liệu doanh thu; quy trình kho đối chiếu lượng nguyên liệu thực tế với số liệu hệ thống."
Add-Figure (Join-Path $assetDir "hinh_3_4_quy_trinh_nghiep_vu.png") "Hình 3.4. Các quy trình nghiệp vụ chính"
Add-Paragraph "Quy trình đăng ký ca bắt đầu khi quản trị viên tạo đợt theo tuần và mở đăng ký. Nhân viên gửi lựa chọn, sau đó quản trị viên xếp lịch, lưu nháp và công bố. Lịch được dùng làm căn cứ chấm công; giờ công hợp lệ cùng mức lương giờ tạo nên bảng lương tháng."
Add-Paragraph "Quy trình vận hành bắt đầu từ bước xác minh nhân viên có lịch, chấm công và phân công phù hợp. Ca sau khi mở sẽ tiếp nhận quỹ đầu, doanh thu và chi phí. Cuối ca, hệ thống tính tiền dự kiến và chênh lệch trước khi báo cáo được gửi và khóa."
Add-Paragraph "Quy trình kho duy trì quan hệ giữa tồn hệ thống và tồn thực đếm. Mỗi lần nhập, xuất hoặc sử dụng tạo ra biến động. Khi đóng sổ, nhân viên xác nhận tồn cuối và bàn giao; trường hợp không khớp sẽ tạo chênh lệch để quản trị viên kiểm tra."

Add-Heading "3.3. Thiết kế hệ thống" 2
Add-Heading "3.3.1. Thiết kế kiến trúc tổng thể" 3
Add-Paragraph "Hệ thống được tổ chức theo kiến trúc client–server. Frontend ReactJS đảm nhiệm giao diện và trạng thái hiển thị; backend Node.js/ExpressJS cung cấp RESTful API, xác thực và xử lý nghiệp vụ; SQL Server lưu dữ liệu quan hệ. Ảnh và tệp được lưu ở vùng lưu trữ được backend kiểm soát, trong khi database lưu metadata và đường dẫn tương đối."
Add-Figure (Join-Path $assetDir "hinh_3_5_kien_truc.png") "Hình 3.5. Kiến trúc tổng thể của hệ thống"
Add-Table @("Tầng","Công nghệ","Trách nhiệm") @(
 @("Trình bày","ReactJS, Vite, React Router","Hiển thị, điều hướng, nhập dữ liệu và gọi API."),@("Dịch vụ","Node.js, ExpressJS","Xác thực, phân quyền, kiểm tra đầu vào và xử lý nghiệp vụ."),@("Dữ liệu","Microsoft SQL Server","Lưu dữ liệu quan hệ, ràng buộc và hỗ trợ truy vấn thống kê."),@("Tệp","Multer và thư mục upload","Tiếp nhận ảnh đại diện, chứng từ và ảnh báo cáo."),@("Trao đổi","HTTP/JSON, JWT, WebSocket","Trao đổi dữ liệu, phiên xác thực và cập nhật chat.")
)

Add-Heading "3.3.2. Thiết kế các module" 3
Add-Table @("Module","Thành phần tiêu biểu","Nhiệm vụ") @(
 @("Xác thực","authRoutes, authMiddleware, roleMiddleware","Đăng nhập, JWT và kiểm tra quyền."),@("Nhân sự","employeeRoutes, profileRoutes","Nhân viên, chi nhánh, tài khoản và hồ sơ."),@("Lịch","scheduleRegistrationController, scheduleController","Đợt đăng ký, xếp và công bố lịch."),@("Chấm công – lương","attendance controller, payroll controller","Ghi giờ công và tổng hợp lương."),@("Vận hành","shiftOperations, shiftReport","Mở ca, doanh thu, đếm tiền, kết ca."),@("Kho","shiftInventory, inventoryRoutes","Kiểm kho, bàn giao, nhập xuất và tồn kho."),@("Báo cáo nội bộ","branchReportController","Vệ sinh, hàng hóa, ảnh và duyệt."),@("Tương tác","chatRoutes, notification routes","Tin nhắn và thông báo."),@("Hệ thống","dashboard, settings, audit","Tổng quan, cấu hình và nhật ký.")
)

Add-Heading "3.3.3. Thiết kế cơ sở dữ liệu" 3
Add-Paragraph "Cơ sở dữ liệu được chuẩn hóa theo các nhóm nghiệp vụ. Bảng nhân viên và chi nhánh đóng vai trò trung tâm để xác định phạm vi dữ liệu. Các bảng giao dịch như chấm công, ca vận hành, báo cáo và kiểm kho tham chiếu đến nhân viên, chi nhánh và ngày nghiệp vụ."
Add-Figure (Join-Path $assetDir "hinh_3_6_erd_logic.png") "Hình 3.6. Mô hình dữ liệu logic theo nhóm"
Add-Table @("Nhóm dữ liệu","Các bảng/đối tượng chính","Ý nghĩa") @(
 @("Tài khoản – nhân viên","roles, users, branches, positions, employees","Danh tính, vai trò và nơi làm việc."),@("Đăng ký – lịch","shifts, registration periods, registrations, employee_schedules","Nhu cầu làm việc và lịch chính thức."),@("Chấm công – lương","attendance_logs, payrolls, payroll_details","Thời gian thực tế và thu nhập."),@("Vận hành ca","shift_sessions, shift_closing_reports, shift_expenses, cash_counts","Mở/kết ca, doanh thu, chi phí và quỹ."),@("Kho hàng","categories, units, products, branch_inventories, inventory_transactions","Danh mục hàng và biến động tồn."),@("Nhập hàng","suppliers, purchase_orders, purchase_receipts, receipt_items","Đặt, nhận hàng và chứng từ."),@("Kiểm kho theo ca","inventory_count_sessions, items, discrepancies, handovers","Tồn đầu/cuối và chênh lệch bàn giao."),@("Hệ thống","chat, notifications, branch_reports, settings, audit_logs","Trao đổi, báo cáo nội bộ và quản trị.")
)
Add-Note "Ảnh Database Diagram vật lý cần bổ sung" "Cách lấy ảnh thật: mở SQL Server Management Studio → Databases → GaDaiCaManagement → Database Diagrams → New Database Diagram. Chọn bảng theo từng cụm, dùng Arrange Tables, phóng to để đọc được tên cột và chụp bằng Snipping Tool. Nên chụp 4 hình riêng: (1) nhân sự–lịch–lương; (2) vận hành ca; (3) kho–nhà cung cấp; (4) chat–thông báo–cài đặt. Thay hoặc đặt các ảnh này ngay sau Hình 3.6."

Add-Heading "3.3.4. Mô tả các bảng dữ liệu chính" 3
Add-Table @("Bảng","Khóa/liên kết chính","Chức năng") @(
 @("users","id, role_id","Tài khoản, mật khẩu băm và trạng thái."),@("branches","id","Thông tin chi nhánh."),@("employees","id, user_id, branch_id, position_id","Hồ sơ nhân viên và lương giờ."),@("shift_registration_periods","id, branch_id","Khoảng thời gian đăng ký theo tuần."),@("shift_registrations","period_id, employee_id, work_date","Lựa chọn ca của nhân viên."),@("employee_schedules","employee_id, branch_id, shift_id, work_date","Lịch làm việc chính thức."),@("attendance_logs","employee_id, schedule_id, work_date","Giờ vào, giờ ra và trạng thái."),@("payrolls","employee_id, period","Tổng hợp lương theo kỳ."),@("shift_sessions","branch_id, employee_id, business_date","Phiên vận hành ca."),@("shift_closing_reports","shift_session_id, employee_id","Doanh thu, chi phí và chênh lệch."),@("products","category_id, unit_id","Nguyên liệu/sản phẩm và định mức tồn."),@("branch_inventories","branch_id, product_id","Số lượng tồn theo chi nhánh."),@("inventory_transactions","branch_id, product_id","Lịch sử nhập, xuất và điều chỉnh."),@("suppliers","id","Thông tin nhà cung cấp."),@("purchase_receipts","supplier_id, branch_id","Phiếu nhận hàng."),@("branch_reports","branch_id, employee_id","Báo cáo vệ sinh/hàng hóa."),@("notifications","user_id","Thông báo và trạng thái đã đọc."),@("system_settings","setting_key","Cấu hình dùng chung."),@("audit_logs","actor_user_id","Lịch sử thao tác quản trị.")
)

Add-Heading "3.3.5. Thiết kế API và luồng trao đổi dữ liệu" 3
Add-Paragraph "Frontend không truy cập trực tiếp SQL Server mà gửi yêu cầu đến API. Backend đọc JWT từ tiêu đề Authorization, kiểm tra vai trò, chuẩn hóa dữ liệu đầu vào và chỉ sau đó mới thực hiện truy vấn. Kết quả được trả về dưới dạng JSON có trạng thái thành công, thông báo và dữ liệu."
Add-Table @("Nhóm endpoint","Phương thức tiêu biểu","Nội dung") @(
 @("/api/auth","POST","Đăng nhập và yêu cầu đặt lại mật khẩu."),@("/api/manager/employees","GET, POST, PUT, DELETE","Quản lý nhân viên."),@("/api/manager/schedule-registration-periods","GET, POST, PUT, PATCH","Đợt đăng ký và công bố lịch."),@("/api/employee/attendance","GET, POST","Chấm công và lịch sử cá nhân."),@("/api/manager/payrolls","GET, POST, PUT, PATCH","Tính và quản lý lương."),@("/api/operations","GET, POST, PUT, DELETE","Mở ca, báo cáo, ảnh và bàn giao."),@("/api/shift-inventory","GET, POST","Phiên kiểm kho và chênh lệch."),@("/api/inventory-overview","GET, POST","Tồn kho, giao dịch và phiếu xuất."),@("/api/branch-reports","GET, POST, PUT","Báo cáo vệ sinh/hàng hóa và duyệt."),@("/api/dashboard","GET","Dữ liệu tổng quan theo ngày/chi nhánh.")
)

Add-Heading "3.3.6. Thiết kế bảo mật và phân quyền" 3
Add-Bullets @("Mật khẩu được băm bằng bcrypt, không lưu mật khẩu rõ trong database.","Sau đăng nhập thành công, backend tạo JWT chứa định danh và vai trò người dùng.","authMiddleware từ chối yêu cầu không có token hoặc token không hợp lệ.","roleMiddleware giới hạn endpoint theo admin, manager hoặc employee.","Controller tiếp tục giới hạn branch_id để tránh truy cập chéo chi nhánh.","Dữ liệu đầu vào được kiểm tra trước khi tạo hoặc cập nhật.","Middleware upload chỉ cho phép loại tệp và dung lượng phù hợp.","Những thao tác quan trọng được ghi vào audit log để truy vết.","Các thông tin bí mật như JWT secret và chuỗi kết nối được đặt trong tệp môi trường.")
Add-Figure (Join-Path $assetDir "hinh_3_8_sequence_dang_nhap.png") "Hình 3.7. Sequence Diagram chức năng đăng nhập"

Add-Heading "3.3.7. Thiết kế xử lý ngày giờ" 3
Add-Paragraph "Hệ thống sử dụng múi giờ nghiệp vụ Asia/Ho_Chi_Minh (GMT+7). Backend chịu trách nhiệm xác định ngày nghiệp vụ để tránh chênh lệch do trình duyệt hoặc máy chủ. Frontend hiển thị ngày theo định dạng ngày/tháng/năm và giờ 24 giờ. Các bộ chọn ngày sử dụng giá trị kỹ thuật yyyy-MM-dd khi gửi API nhưng hiển thị dd/MM/yyyy cho người dùng."
Add-Paragraph "Trong môi trường thử nghiệm, đồng hồ nghiệp vụ có thể được cấu hình riêng để kiểm tra dữ liệu lịch sử mà không thay đổi đồng hồ hệ điều hành. Dữ liệu thử nghiệm phải được đánh dấu và tách biệt với dữ liệu production."

Add-Heading "3.3.8. Thiết kế quản lý ảnh và tệp" 3
Add-Table @("Loại tệp","Nghiệp vụ","Biện pháp kiểm soát") @(
 @("Ảnh đại diện","Hồ sơ nhân viên","Chỉ ảnh hợp lệ, đổi tên tệp, lưu đường dẫn."),@("Ảnh POS/kết ca","Báo cáo doanh thu","Gắn với shift_session và người tải."),@("Ảnh phiếu nhập","Nhận hàng","Gắn với phiếu và dùng khi duyệt."),@("Ảnh báo cáo nội bộ","Vệ sinh/hàng hóa","Gắn với báo cáo và chi nhánh."),@("Tệp chat","Trao đổi nội bộ","Lưu metadata, tên gốc và đường dẫn an toàn.")
)

Add-Heading "3.3.9. Thiết kế giao diện" 3
Add-Paragraph "Giao diện quản trị viên sử dụng thanh menu bên trái để nhóm các chức năng nhân sự, kho, cửa hàng và hệ thống. Thanh tiêu đề phía trên hiển thị tên trang, ngày hiện tại, tìm kiếm, chuông thông báo và tài khoản. Nội dung chính sử dụng thẻ thống kê, bảng dữ liệu, bộ lọc, biểu đồ và modal."
Add-Paragraph "Giao diện nhân viên ưu tiên thao tác nhanh bằng các thẻ chức năng: đăng ký lịch, lịch làm, chấm công, lương, mở/kết ca, kiểm kho, báo cáo và chat. Trên màn hình nhỏ, bố cục chuyển thành dạng một cột hoặc lưới để người dùng có thể thao tác bằng cảm ứng."
Add-Paragraph "Hệ thống sử dụng màu vàng làm màu nhận diện, nền vàng nhạt ở khu vực điều hướng, màu xanh cho trạng thái thành công và màu đỏ cho lỗi hoặc chênh lệch. Các trường ngày hiển thị theo chuẩn Việt Nam và mọi biểu mẫu dùng khoảng cách, bo góc và trạng thái nút nhất quán."
Add-Note "Ảnh giao diện cần chụp từ hệ thống" "Cần đăng nhập từng vai trò và chụp bằng Snipping Tool: (1) trang Tổng quan Admin ở độ phân giải 1920×1080; (2) trang chủ Nhân viên; (3) sidebar khi mở đầy đủ; (4) một form/modal tiêu biểu. Ẩn thanh địa chỉ trình duyệt nếu quy định báo cáo yêu cầu, cắt phần thừa và giữ cùng tỷ lệ. Chèn hai ảnh bố cục tổng quát tại mục này; ảnh chi tiết từng chức năng để dành cho Chương 4."

Add-Heading "3.3.10. Sơ đồ điều hướng giao diện" 3
Add-Paragraph "Sau khi đăng nhập, RoleHome và các route bảo vệ xác định vai trò để chuyển người dùng đến khu vực tương ứng. ManagerRoute bảo vệ khu vực quản trị, EmployeeRoute bảo vệ khu vực nhân viên. Việc ẩn menu ở frontend giúp giao diện gọn hơn nhưng quyền cuối cùng vẫn được kiểm tra ở backend."
Add-Figure (Join-Path $assetDir "hinh_3_7_dieu_huong.png") "Hình 3.8. Sơ đồ điều hướng giao diện theo vai trò"

Add-Heading "3.3.11. Thiết kế Sequence Diagram" 3
Add-Paragraph "Sequence Diagram đăng nhập thể hiện rõ sự phối hợp giữa người dùng, ReactJS, ExpressJS và SQL Server. Tương tự, các nghiệp vụ chấm công hoặc kết ca đều được xử lý qua API và không cho phép giao diện ghi trực tiếp vào database."
Add-Note "Các Sequence Diagram có thể bổ sung" "Nếu giảng viên yêu cầu tối thiểu ba sơ đồ, có thể tạo thêm: (1) chấm công vào/ra; (2) gửi báo cáo và kết ca; (3) kiểm kho và bàn giao. Cách làm: dùng draw.io → UML → Sequence, đặt bốn lifeline Nhân viên, ReactJS, Express API, SQL Server; thêm message theo thứ tự API trong mã nguồn; xuất PNG độ phân giải 2× và chèn sau mục này."

Add-Heading "3.4. Tổng kết chương" 2
Add-Paragraph "Chương 3 đã phân tích bài toán quản lý cửa hàng thức ăn nhanh, xác định phạm vi, tác nhân, yêu cầu chức năng, yêu cầu phi chức năng và các quy tắc nghiệp vụ. Hệ thống được phân chia thành các nhóm chức năng liên kết từ quản lý nhân sự, lịch làm việc, chấm công và lương đến vận hành ca, doanh thu, kiểm kho, tổng kho và tương tác nội bộ."
Add-Paragraph "Trên cơ sở phân tích, chương đã đề xuất kiến trúc client–server gồm ReactJS, Node.js/ExpressJS và SQL Server; đồng thời trình bày thiết kế module, cơ sở dữ liệu, API, bảo mật, thời gian, tệp và giao diện. Những thiết kế này là nền tảng cho việc cài đặt, thực nghiệm, kiểm thử và đánh giá hệ thống ở Chương 4."

Add-PageBreak
Add-Heading "PHỤ LỤC HƯỚNG DẪN HOÀN THIỆN HÌNH ẢNH CHƯƠNG 3" 1
Add-Table @("Hình cần hoàn thiện","Nguồn lấy","Cách thực hiện") @(
 @("Database Diagram vật lý","SQL Server Management Studio","Mở Database Diagrams, chọn từng nhóm bảng, Arrange Tables, chụp 2× và thay tại mục 3.3.3."),@("Bố cục Admin","Website /manager/dashboard","Thu gọn dữ liệu nhạy cảm, chụp toàn màn hình nội dung và cắt thanh trình duyệt."),@("Bố cục Nhân viên","Website /employee/home","Đăng nhập tài khoản nhân viên, chụp lưới tiện ích và thanh điều hướng."),@("Sequence chấm công","draw.io","Dựa theo employeeOperationsRoutes và controller để vẽ request, kiểm tra lịch, ghi attendance_logs và response."),@("Sequence kết ca","draw.io","Dựa theo shiftOperationsRoutes và shiftReportController; thể hiện validation, transaction, báo cáo và khóa ca.")
)
Add-Paragraph "Lưu ý: Các sơ đồ minh họa trong tài liệu này được dựng từ cấu trúc chức năng và mã nguồn hiện tại. Trước khi nộp, cần cập nhật số thứ tự hình/bảng theo toàn bộ báo cáo, thêm nguồn 'Tác giả xây dựng' nếu mẫu trường yêu cầu và cập nhật mục lục tự động trong Word." -Italic

$body.Add('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1984" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>')
$package=Join-Path $root 'chapter3_package'
if([IO.Directory]::Exists($package)){[IO.Directory]::Delete($package,$true)}
[IO.Directory]::CreateDirectory($package)|Out-Null;[IO.Directory]::CreateDirectory((Join-Path $package '_rels'))|Out-Null;[IO.Directory]::CreateDirectory((Join-Path $package 'word'))|Out-Null;[IO.Directory]::CreateDirectory((Join-Path $package 'word\_rels'))|Out-Null;[IO.Directory]::CreateDirectory((Join-Path $package 'word\media'))|Out-Null
$utf8=New-Object Text.UTF8Encoding($false)
$contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
$rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
$styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:outlineLvl w:val="0"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:outlineLvl w:val="1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:outlineLvl w:val="2"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:sz w:val="22"/></w:rPr></w:style></w:styles>'
$document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+($body-join '')+'</w:body></w:document>'
$docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+($imageRelationships-join '')+'<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
[IO.File]::WriteAllText((Join-Path $package '[Content_Types].xml'),$contentTypes,$utf8);[IO.File]::WriteAllText((Join-Path $package '_rels\.rels'),$rootRels,$utf8);[IO.File]::WriteAllText((Join-Path $package 'word\styles.xml'),$styles,$utf8);[IO.File]::WriteAllText((Join-Path $package 'word\document.xml'),$document,$utf8);[IO.File]::WriteAllText((Join-Path $package 'word\_rels\document.xml.rels'),$docRels,$utf8)
foreach($image in $images){[IO.File]::Copy($image[0],(Join-Path $package "word\media\$($image[1])"),$true)}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if([IO.File]::Exists($output)){[IO.File]::Delete($output)}
$outStream=[IO.File]::Open($output,[IO.FileMode]::CreateNew)
$archive=[IO.Compression.ZipArchive]::new($outStream,[IO.Compression.ZipArchiveMode]::Create,$false)
try{foreach($file in [IO.Directory]::GetFiles($package,'*',[IO.SearchOption]::AllDirectories)){$entryName=$file.Substring($package.Length+1).Replace('\','/');$entry=$archive.CreateEntry($entryName,[IO.Compression.CompressionLevel]::Optimal);$source=[IO.File]::OpenRead($file);$target=$entry.Open();try{$source.CopyTo($target)}finally{$target.Dispose();$source.Dispose()}}}finally{$archive.Dispose();$outStream.Dispose()}
[IO.Directory]::Delete($package,$true)
Write-Output $output
