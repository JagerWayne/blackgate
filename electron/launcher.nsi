; blackgate.exe: a small launcher that carries the whole unpacked app.
; If Documents\Games\Blackgate\app holds this version, it starts that copy at
; once. Otherwise it copies the app there first (showing a progress window),
; writes version.json last so a half-finished copy is never trusted, and
; starts it. Saves and data files beside app\ are never touched.
; Built by electron/build-launcher.js, which passes VERSION, BUILD, SRC, ICON, OUT.

Unicode true
!include "FileFunc.nsh"

Name "BLACKGATE"
Caption "BLACKGATE - installing update ${VERSION}"
OutFile "${OUT}"
Icon "${ICON}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails nevershow
AutoCloseWindow true
BrandingText " "
Page instfiles

!define APPDIR "$DOCUMENTS\Games\Blackgate\app"
; the build id, not just the version: every rebuild reinstalls once
!define STAMP '{"version":"${VERSION}","build":"${BUILD}"}'

Function Launch
  ${GetParameters} $1
  Exec '"${APPDIR}\BLACKGATE.exe" $1'
FunctionEnd

Function .onInit
  SetShellVarContext current
  IfFileExists "${APPDIR}\BLACKGATE.exe" 0 install
  IfFileExists "${APPDIR}\resources\app.asar" 0 install
  ClearErrors
  FileOpen $0 "${APPDIR}\version.json" r
  IfErrors install
  FileRead $0 $2
  FileClose $0
  StrCmp $2 '${STAMP}' 0 install
  Call Launch
  Abort ; up to date: start it and show nothing
  install:
FunctionEnd

Section
  SetShellVarContext current
  DetailPrint "Installing BLACKGATE ${VERSION}..."
  Delete "${APPDIR}\version.json"
  RMDir /r "${APPDIR}"
  SetOutPath "${APPDIR}"
  File /r "${SRC}\*.*"
  FileOpen $0 "${APPDIR}\version.json" w
  FileWrite $0 '${STAMP}'
  FileClose $0
  Call Launch
SectionEnd
