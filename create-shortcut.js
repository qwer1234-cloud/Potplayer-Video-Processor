const fs = require('fs');
const path = require('path');

// Desktop path for current user
const desktopPath = path.join('C:\\Users\\sunhao\\Desktop');
const shortcutPath = path.join(desktopPath, 'Video Processing Tool.lnk');
const appPath = path.join('D:\\ProcessVideo', 'main.js');

// Create a batch file that will launch the application
const batchContent = `@echo off
echo Starting Video Processing Tool...
cd /d "D:\ProcessVideo"
node main.js
pause`;

const batchFilePath = path.join('D:\\ProcessVideo', 'launch-app.bat');

// Create the batch file
fs.writeFileSync(batchFilePath, batchContent, 'utf8');
console.log('Batch file created:', batchFilePath);

// Create VBS script to create shortcut
const vbsContent = `
Set WshShell = WScript.CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShellLink = WshShell.CreateShortcut(strDesktop & "\\Video Processing Tool.lnk")
oShellLink.TargetPath = "${batchFilePath.replace(/\\/g, '\\\\')}"
oShellLink.WindowStyle = 1
oShellLink.Description = "Video Processing Tool - Extract video segments and create GIFs"
oShellLink.WorkingDirectory = "D:\\ProcessVideo"
oShellLink.Save
WScript.Echo "Shortcut created successfully on desktop"
`;

const vbsFilePath = path.join('D:\\ProcessVideo', 'create-shortcut.vbs');
fs.writeFileSync(vbsFilePath, vbsContent, 'utf8');

console.log('VBS script created. Run this script to create the desktop shortcut.');
console.log('VBS file location:', vbsFilePath);
console.log('To create the shortcut, run:');
console.log('cscript "' + vbsFilePath + '"');