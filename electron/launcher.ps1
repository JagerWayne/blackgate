# The launcher's updater, run hidden by blackgate.exe (electron/launcher.nsi).
# Reads the latest GitHub release; when its build is newer than the installed
# app (or nothing is installed) it shows a window from the start (checking, then updating from which version
# to which), downloads the app zip with a progress bar,
# checks its SHA-256, unpacks it beside app\, swaps it in, writes
# app\version.json last, and starts the game. Offline it starts what is
# installed. Only app\ is ever replaced: saves and data files are not touched.
param([Parameter(Mandatory)][string]$Root, [string]$GameArgs = '')

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = 'JagerWayne/blackgate'
$Headers = @{ 'User-Agent' = 'blackgate-launcher' }
$App = Join-Path $Root 'app'
$Exe = Join-Path $App 'BLACKGATE.exe'

function Start-Game {
  if ($form) { $form.Close() }
  if ($GameArgs) { Start-Process $Exe -ArgumentList $GameArgs } else { Start-Process $Exe }
  exit 0
}
function Fail([string]$why) {
  if ($form) { $form.Close() }
  [Windows.Forms.MessageBox]::Show($why, 'BLACKGATE', 'OK', 'Error') | Out-Null
  exit 1
}
function Installed-Build {
  try { (Get-Content (Join-Path $App 'version.json') -Raw | ConvertFrom-Json).build } catch { $null }
}
function Installed-Version {
  try { (Get-Content (Join-Path $App 'version.json') -Raw | ConvertFrom-Json).version } catch { $null }
}
$ready = (Test-Path $Exe) -and (Test-Path (Join-Path $App 'resources\app.asar'))
$have = if ($ready) { Installed-Build } else { $null }

# the window shows from the first moment, so a slow check never looks like
# nothing is happening
Add-Type -AssemblyName System.Windows.Forms, System.IO.Compression.FileSystem
$form = New-Object Windows.Forms.Form -Property @{
  Text = 'BLACKGATE'; Width = 440; Height = 130; FormBorderStyle = 'FixedDialog'
  StartPosition = 'CenterScreen'; MaximizeBox = $false; MinimizeBox = $false; TopMost = $true
}
$label = New-Object Windows.Forms.Label -Property @{ Left = 14; Top = 14; Width = 400; Text = 'Checking for updates...' }
$bar = New-Object Windows.Forms.ProgressBar -Property @{ Left = 14; Top = 42; Width = 396; Height = 22; Style = 'Marquee' }
$form.Controls.AddRange(@($label, $bar))
$form.Show()
[Windows.Forms.Application]::DoEvents()
function Say([string]$text) { $label.Text = $text; [Windows.Forms.Application]::DoEvents() }

# 1. what is the latest build?
try {
  $rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers $Headers -TimeoutSec 15
  $asset = { param($n) $rel.assets | Where-Object name -eq $n | Select-Object -First 1 }
  # through the API, not the download link: a re-uploaded asset gets a new id,
  # while the download link can be served stale from a cache for a while
  $latest = Invoke-RestMethod (& $asset 'latest.json').url -Headers ($Headers + @{ Accept = 'application/octet-stream' }) -TimeoutSec 15
  if ($latest -is [string]) { $latest = $latest | ConvertFrom-Json }
  $zipUrl = (& $asset $latest.zip).browser_download_url
  if (-not $latest.build -or -not $latest.sha256 -or -not $zipUrl) { throw 'the release has no app archive' }
} catch {
  if ($ready) { Start-Game }
  Fail "BLACKGATE could not reach GitHub to download the game, and it is not installed yet.`n`n$($_.Exception.Message)`n`nCheck your connection and try again."
}
if ($ready -and $have -eq $latest.build) {
  Say "BLACKGATE $($latest.version) is up to date. Starting..."
  Start-Game
}

# 2. download it, with a progress bar that says from which version to which
$zip = Join-Path $env:TEMP "blackgate-$([guid]::NewGuid()).zip"
$from = Installed-Version
$what = if ($ready -and $from) { "Updating BLACKGATE $from -> $($latest.version)" } else { "Installing BLACKGATE $($latest.version)" }
$bar.Style = 'Continuous'
Say "$what..."
$size = [double]$latest.size
$wc = New-Object Net.WebClient
$wc.Headers.Add('User-Agent', 'blackgate-launcher')
try {
  $wc.DownloadFileAsync([Uri]$zipUrl, $zip)
  while ($wc.IsBusy) {
    if ($size -gt 0 -and (Test-Path $zip)) {
      $got = (Get-Item $zip).Length
      $bar.Value = [Math]::Min(100, [int](100 * $got / $size))
      $label.Text = '{0}...  {1:N0} / {2:N0} MB' -f $what, ($got / 1MB), ($size / 1MB)
    }
    [Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 100
  }

  # 3. check it, unpack it next to app\, then swap
  $label.Text = 'Checking the download...'; [Windows.Forms.Application]::DoEvents()
  if (-not (Test-Path $zip) -or (Get-FileHash $zip -Algorithm SHA256).Hash -ne $latest.sha256.ToUpper()) {
    throw 'the download is damaged (checksum mismatch)'
  }
  $label.Text = 'Installing...'; $bar.Style = 'Marquee'; [Windows.Forms.Application]::DoEvents()
  $new = "$App.new"
  $old = "$App.old"
  foreach ($d in @($new, $old)) { if (Test-Path $d) { Remove-Item $d -Recurse -Force } }
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $new)
  if (-not (Test-Path "$new\BLACKGATE.exe") -or -not (Test-Path "$new\resources\app.asar")) { throw 'the archive is incomplete' }
  if (Test-Path $App) { Rename-Item $App $old } # fails while the game runs: the old app stays
  try {
    Rename-Item $new $App
  } catch {
    if (Test-Path $old) { Rename-Item $old $App }
    throw
  }
  # version.json last: a copy without it is never trusted
  @{ version = $latest.version; build = $latest.build } | ConvertTo-Json -Compress | Set-Content (Join-Path $App 'version.json') -Encoding ascii
  if (Test-Path $old) { Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue }
} catch {
  $form.Close()
  if (Test-Path "$App.new") { Remove-Item "$App.new" -Recurse -Force -ErrorAction SilentlyContinue }
  Add-Content (Join-Path $Root 'blackgate.log') "$(Get-Date -Format o) launcher: update to $($latest.build) failed: $($_.Exception.Message)" -ErrorAction SilentlyContinue
  if ($ready -and (Test-Path $Exe)) { Start-Game } # keep playing the installed build
  Fail "BLACKGATE could not install the update.`n`n$($_.Exception.Message)`n`nIf the game is open, close it and try again."
} finally {
  if (Test-Path $zip) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
}
$bar.Value = 100
Say "Updated to BLACKGATE $($latest.version). Starting..."
Start-Sleep -Milliseconds 900
Start-Game
