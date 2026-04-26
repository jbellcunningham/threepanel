param(
  [Parameter(Mandatory=$true)]
  [string]$Message
)

Set-Location "C:\Users\JamesCunningham\OneDrive - Brown Trout Systems\Documents\Cursor Projects\Me_Tracker\threepanel-git"

git status
git add -A
git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw "Commit failed or nothing to commit." }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push failed." }

Write-Host "Done."