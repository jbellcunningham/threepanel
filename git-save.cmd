@echo off
setlocal

REM Usage:
REM   git-save.cmd "Your commit message"

if "%~1"=="" (
  echo Usage: git-save.cmd "commit message"
  exit /b 1
)

cd /d "C:\Users\JamesCunningham\OneDrive - Brown Trout Systems\Documents\Cursor Projects\Me_Tracker\threepanel-git" || exit /b 1

git status
git add -A
git commit -m "%~1"
if errorlevel 1 (
  echo Commit failed or nothing to commit.
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo Push failed.
  exit /b 1
)

echo Done.