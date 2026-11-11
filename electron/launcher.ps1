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
# --clean (on the shortcut or the command line) or the tick box: remove the installed version first and download every file again.
# Only app\ is replaced, so saves and data files stay.
$Clean = $GameArgs -match '(^|\s)--clean(\s|$)'
if ($Clean) { $GameArgs = ($GameArgs -replace '(^|\s)--clean(\s|$)', ' ').Trim() }
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
  Text = 'BLACKGATE'; Width = 480; Height = 175; FormBorderStyle = 'FixedDialog'
  StartPosition = 'CenterScreen'; MaximizeBox = $false; MinimizeBox = $false; TopMost = $true
}
$label = New-Object Windows.Forms.Label -Property @{ Left = 14; Top = 14; Width = 440; Height = 28; Text = 'Checking for updates...'; Font = New-Object Drawing.Font('Segoe UI', 11) }
$bar = New-Object Windows.Forms.ProgressBar -Property @{ Left = 14; Top = 52; Width = 436; Height = 24; Style = 'Marquee' }
$box = New-Object Windows.Forms.CheckBox -Property @{ Left = 14; Top = 84; Width = 440; Height = 24; Text = 'Force remove the previous version first (closes the game; saves are kept)'; Checked = $Clean }
$form.Controls.AddRange(@($label, $bar, $box))
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
  # newer releases list every file (path, hash, size, release tag) and the launcher fetches only what changed;
  # older ones are one zip, which the launchers installed earlier still use
  $zipUrl = if ($latest.zip) { (& $asset $latest.zip).browser_download_url } else { $null }
  if (-not $latest.build -or -not ($latest.files -or ($latest.sha256 -and $zipUrl))) { throw 'the release has no app files' }
} catch {
  if ($ready) { Start-Game }
  Fail "BLACKGATE could not reach GitHub to download the game, and it is not installed yet.`n`n$($_.Exception.Message)`n`nCheck your connection and try again."
}
if ($ready -and $have -eq $latest.build) {
  Say "BLACKGATE $($latest.version) is up to date. Starting..."
  Start-Game
}

# 2. download it, with a progress bar that says from which version to which
$zip = $null
$from = Installed-Version
$what = if ($ready -and $from) { "Updating to version $($latest.version)" } else { "Installing version $($latest.version)" }
$bar.Style = 'Continuous'
Say "$what..."
$new = "$App.new"
$old = "$App.old"
try {
  foreach ($d in @($new, $old)) { if (Test-Path $d) { Remove-Item $d -Recurse -Force } }
  if ($latest.files) {
    # only the files that differ from the installed copy: compared by size, then SHA-256
    $clean = $box.Checked
    $box.Enabled = $false
    $todo = @()
    $n = 0
    foreach ($f in $latest.files) {
      $n++
      Say "Comparing installed files... $n of $($latest.files.Count)"
      $local = Join-Path $App $f.p
      $same = (Test-Path $local) -and ((Get-Item $local).Length -eq [int64]$f.s) -and ((Get-FileHash $local -Algorithm SHA256).Hash -eq $f.h.ToUpper())
      if ($clean -or -not $same) { $todo += $f }
    }
    $total = [double](($todo | Measure-Object s -Sum).Sum)
    # one row per file to download, each with its own percent bar
    $panel = New-Object Windows.Forms.Panel -Property @{ Left = 14; Top = 114; Width = 436; Height = 250; AutoScroll = $true; BorderStyle = 'FixedSingle' }
    $form.Controls.Add($panel)
    $form.Height = 430
    $rows = @{}
    $y = 4
    foreach ($f in $todo) {
      $name = New-Object Windows.Forms.Label -Property @{ Left = 4; Top = $y; Width = 230; Height = 18; Text = ('{0} ({1:N1} MB)' -f $f.p, ($f.s / 1MB)); AutoEllipsis = $true }
      $pct = New-Object Windows.Forms.Label -Property @{ Left = 238; Top = $y; Width = 40; Height = 18; Text = '0%'; TextAlign = 'MiddleRight' }
      $fb = New-Object Windows.Forms.ProgressBar -Property @{ Left = 284; Top = $y; Width = 126; Height = 16; Style = 'Continuous' }
      $panel.Controls.AddRange(@($name, $pct, $fb))
      $rows[$f.p] = @($pct, $fb, $name)
      $y += 22
    }
    $form.Refresh()
    if ($todo.Count -eq 0) { Say "$what... nothing to download" } else { Say "$what... preparing" }
    if ((Test-Path $App) -and -not $clean) { Copy-Item $App $new -Recurse } else { New-Item -ItemType Directory $new | Out-Null }
    $done = 0.0
    foreach ($f in $todo) {
      $dest = Join-Path $new $f.p
      $pct, $fb, $name = $rows[$f.p]
      $panel.ScrollControlIntoView($name)
      New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
      if (Test-Path $dest) { Remove-Item $dest -Force }
      $wc = New-Object Net.WebClient
      $wc.Headers.Add('User-Agent', 'blackgate-launcher')
      $wc.DownloadFileAsync([Uri]"https://github.com/$Repo/releases/download/$($f.t)/$($f.h)", $dest)
      while ($wc.IsBusy) {
        if (Test-Path $dest) {
          $got = (Get-Item $dest).Length
          if ($f.s -gt 0) { $fb.Value = [Math]::Min(100, [int](100 * $got / $f.s)) }
          $pct.Text = "$($fb.Value)%"
          if ($total -gt 0) { $bar.Value = [Math]::Min(100, [int](100 * ($done + $got) / $total)) }
          $label.Text = '{0}... {1}%' -f $what, $bar.Value
        }
        [Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 80
      }
      if (-not (Test-Path $dest) -or (Get-FileHash $dest -Algorithm SHA256).Hash -ne $f.h.ToUpper()) { throw "$($f.p) did not download correctly" }
      $fb.Value = 100; $pct.Text = '100%'
      $done += [double]$f.s
    }
    # files the new build no longer has
    $keep = @($latest.files | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $new $_.p)).ToLower() })
    Get-ChildItem $new -Recurse -File | Where-Object { $keep -notcontains $_.FullName.ToLower() } | Remove-Item -Force
  } else {
    $zip = Join-Path $env:TEMP "blackgate-$([guid]::NewGuid()).zip"
    $size = [double]$latest.size
    $wc = New-Object Net.WebClient
    $wc.Headers.Add('User-Agent', 'blackgate-launcher')
    $wc.DownloadFileAsync([Uri]$zipUrl, $zip)
    while ($wc.IsBusy) {
      if ($size -gt 0 -and (Test-Path $zip)) {
        $got = (Get-Item $zip).Length
        $bar.Value = [Math]::Min(100, [int](100 * $got / $size))
        $label.Text = '{0}... {1}%' -f $what, $bar.Value
      }
      [Windows.Forms.Application]::DoEvents()
      Start-Sleep -Milliseconds 100
    }
    $bar.Value = 100
    $label.Text = "$what... 100% // checking the download"; [Windows.Forms.Application]::DoEvents()
    if (-not (Test-Path $zip) -or (Get-FileHash $zip -Algorithm SHA256).Hash -ne $latest.sha256.ToUpper()) {
      throw 'the download is damaged (checksum mismatch)'
    }
    $label.Text = "$what... installing"; $bar.Style = 'Marquee'; [Windows.Forms.Application]::DoEvents()
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $new)
  }
  $bar.Value = 100; $bar.Style = 'Marquee'
  if (-not (Test-Path "$new\BLACKGATE.exe") -or -not (Test-Path "$new\resources\app.asar")) { throw 'the update is incomplete' }
  if ($clean -and (Test-Path $App)) {
    # forced: close a running copy and delete the old version for good, only after the new files are all here
    Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($App, [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 20 -and (Test-Path $App); $i++) {
      Remove-Item $App -Recurse -Force -ErrorAction SilentlyContinue
      if (Test-Path $App) { Start-Sleep -Milliseconds 300 }
    }
    if (Test-Path $App) { throw 'the previous version could not be removed' }
  }
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
  if ($zip -and (Test-Path $zip)) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
}
$bar.Value = 100
Say "Updated to version $($latest.version). Starting..."
Start-Sleep -Milliseconds 900
Start-Game
