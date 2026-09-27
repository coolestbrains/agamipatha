const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { AUTHOR, byline, IMPRINT } = require("./credit");

const root = path.resolve(__dirname, "..", "..");
const store = path.join(root, "api", "Store");
const art = path.join(store, "art", "covers");
const publicStore = path.join(root, "public", "store");

const COVERS = [
  {
    file: "career-path-planner-cover.png",
    kicker: `${IMPRINT.toUpperCase()} DIGITAL EDITION`,
    title: "Career Path Planner",
  },
  {
    file: "all-career-paths-cover.png",
    kicker: `${IMPRINT.toUpperCase()} DIGITAL EDITION`,
    title: "All Career Paths",
  },
  {
    file: "99-recipes-for-bachelors-cover.png",
    kicker: `${IMPRINT.toUpperCase()} KITCHEN`,
    title: "99 Cost-Effective Recipes for Bachelors",
    banner: 0.38,
  },
  {
    file: "class-10-stream-chooser-cover.png",
    kicker: `${IMPRINT.toUpperCase()} CLASS 10 WORKBOOK`,
    title: "Stream Chooser",
  },
  {
    file: "first-year-college-survival-cover.png",
    kicker: `${IMPRINT.toUpperCase()} FIRST YEAR`,
    title: "College Survival",
  },
];

const ps1 = `
Add-Type -AssemblyName System.Drawing
$covers = ConvertFrom-Json @'
${JSON.stringify(COVERS)}
'@
$art = ${JSON.stringify(art)}
$store = ${JSON.stringify(store)}
$public = ${JSON.stringify(publicStore)}
$byline = ${JSON.stringify(byline)}

function Stamp-Cover([string]$Src, [string]$Dest, [string]$Kicker, [string]$Title, [string]$Byline, [double]$Banner = 0.24) {
  $srcImg = [System.Drawing.Image]::FromFile($Src)
  $bmp = New-Object System.Drawing.Bitmap $srcImg.Width, $srcImg.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.DrawImage($srcImg, 0, 0, $srcImg.Width, $srcImg.Height)
  $srcImg.Dispose()

  $w = $bmp.Width
  $h = $bmp.Height
  $topH = [int]($h * $Banner)
  $botH = [int]($h * 0.12)
  $overlay = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 22, 14, 61))
  $g.FillRectangle($overlay, 0, 0, $w, $topH)
  $g.FillRectangle($overlay, 0, ($h - $botH), $w, $botH)

  $pad = 40
  $kickerFont = New-Object System.Drawing.Font 'Georgia', 14, ([System.Drawing.FontStyle]::Bold)
  $titleFont = New-Object System.Drawing.Font 'Georgia', 32, ([System.Drawing.FontStyle]::Bold)
  $byFont = New-Object System.Drawing.Font 'Georgia', 18, ([System.Drawing.FontStyle]::Italic)
  $pink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 45, 146))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 246, 255))
  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 20, 212, 232))
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $center.LineAlignment = [System.Drawing.StringAlignment]::Center

  $g.DrawString($Kicker, $kickerFont, $pink, [float]$pad, [float]22)
  $titleBox = New-Object System.Drawing.RectangleF ($pad, 52, ($w - 2 * $pad), ($topH - 70))
  $g.DrawString($Title, $titleFont, $white, $titleBox, $fmt)
  $authorBox = New-Object System.Drawing.RectangleF (0, ($h - $botH), $w, $botH)
  $g.DrawString($Byline, $byFont, $cyan, $authorBox, $center)

  $kickerFont.Dispose(); $titleFont.Dispose(); $byFont.Dispose()
  $pink.Dispose(); $white.Dispose(); $cyan.Dispose(); $overlay.Dispose(); $fmt.Dispose(); $center.Dispose()
  $g.Dispose()

  $dir = Split-Path $Dest
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  if (Test-Path $Dest) { Remove-Item $Dest -Force }
  $bmp.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Item -ItemType Directory -Force -Path $public | Out-Null
foreach ($cover in $covers) {
  $src = Join-Path $art $cover.file
  if (-not (Test-Path $src)) { throw "Missing cover art: $src" }
  $dest = Join-Path $store $cover.file
  $ratio = 0.24
  if ($cover.banner) { $ratio = [double]$cover.banner }
  Stamp-Cover $src $dest $cover.kicker $cover.title $byline $ratio
  Copy-Item $dest (Join-Path $public $cover.file) -Force
  Write-Output ("stamped " + $cover.file)
}
`;

const tmp = path.join(__dirname, ".stamp-covers.ps1");
fs.writeFileSync(tmp, ps1, "utf8");
const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp], {
  encoding: "utf8",
});
fs.unlinkSync(tmp);
if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
if (result.status !== 0) {
  process.exit(result.status || 1);
}
console.log(`Cover byline: ${byline} (${AUTHOR})`);
