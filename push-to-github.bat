@echo off
chcp 65001 > nul
echo ============================================================================
echo กำลังนำโค้ดขึ้น GitHub Repository: https://github.com/seree999-dot/skrustore.git
echo โครงการ: ระบบบริหารจัดการร้านค้าในมหาวิทยาลัยราชภัฏสงขลา
echo ============================================================================

git init
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/seree999-dot/skrustore.git

git add .
git commit -m "feat: ระบบบริหารจัดการร้านค้า มรภ.สงขลา (SKRU Store Management) พร้อม Google Login Mockup และ Google Sheets Backend"

echo.
echo กำลัง Push ไปยัง remote repository (main)...
git push -u origin main

echo.
echo ============================================================================
echo เสร็จสิ้นเรียบร้อย! สามารถเปิดดู Repository ได้ที่:
echo https://github.com/seree999-dot/skrustore
echo ============================================================================
pause
