# Chot mot phase: kiem tra cay sach -> sinh bang chung -> commit bang chung -> gan tag -> push.
# Dung: .\scripts\tag-phase.ps1 -Phase 1
param([Parameter(Mandatory = $true)][ValidateRange(1, 4)][int]$Phase)

$ErrorActionPreference = "Stop"

if (git status --porcelain) {
    Write-Error "Cay lam viec chua sach. Hay commit het truoc khi chot phase."
}

node scripts/evidence.mjs $Phase
if ($LASTEXITCODE -ne 0) { Write-Error "Test do (exit $LASTEXITCODE). Khong gan tag." }

git add docs/proof
git commit -m "Phase ${Phase}: bang chung kiem chung" | Out-Null
git tag "phase-$Phase"
git push origin HEAD
git push origin "phase-$Phase"

git --no-pager log --oneline -3
git tag --list
