; Blackgate_Installer.exe: a small launcher that carries none of the game.
; It copies itself to Documents\Games\Blackgate (so the shortcut does not
; depend on where it was downloaded), makes the BLACKGATE desktop shortcut if
; it is missing, then runs electron/launcher.ps1, which downloads or updates
; the game from the latest GitHub release and starts it.
; Built by electron/release.js, which passes ICON and OUT.

Unicode true
!include "FileFunc.nsh"

Name "BLACKGATE"
OutFile "${OUT}"
Icon "${ICON}"
RequestExecutionLevel user
SilentInstall silent
SetCompressor /SOLID lzma

!define HOME "$DOCUMENTS\Games\Blackgate"

Section
  SetShellVarContext current
  CreateDirectory "${HOME}"
  ; keep a copy of the launcher with the game; refreshed when a newer one runs
  StrCmp "$EXEPATH" "${HOME}\blackgate.exe" +2
    CopyFiles /SILENT "$EXEPATH" "${HOME}\blackgate.exe"
  IfFileExists "$DESKTOP\BLACKGATE.lnk" +2
    CreateShortCut "$DESKTOP\BLACKGATE.lnk" "${HOME}\blackgate.exe" "" "${HOME}\blackgate.exe" 0
  InitPluginsDir
  File "/oname=$PLUGINSDIR\launcher.ps1" "launcher.ps1"
  ${GetParameters} $0
  ; ExecWait with a hidden console (not nsExec, which pipes the output): the update window must show
  ExecWait 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$PLUGINSDIR\launcher.ps1" -Root "${HOME}" -GameArgs "$0"'
SectionEnd
