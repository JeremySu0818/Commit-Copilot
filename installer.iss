[Setup]
AppName=Auto-Commit
AppVersion=1.0.0
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Auto-Commit
DefaultGroupName=Auto-Commit
UninstallDisplayIcon={app}\Auto-Commit.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.
OutputBaseFilename=Auto-Commit-Setup
SetupIconFile=assets\icon.ico

[Files]
Source: "dist\Auto-Commit.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Auto-Commit"; Filename: "{app}\Auto-Commit.exe"
Name: "{userdesktop}\Auto-Commit"; Filename: "{app}\Auto-Commit.exe"

[Run]
Filename: "{app}\Auto-Commit.exe"; Description: "Launch Auto-Commit"; Flags: postinstall nowait