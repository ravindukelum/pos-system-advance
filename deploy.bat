@echo off
REM efix solution POS System - cPanel Deployment Script for Windows
REM This script automates the deployment process for cPanel hosting

echo 🚀 Starting efix solution POS System Deployment...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 14+ before proceeding.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm before proceeding.
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo [INFO] npm version:
npm --version
echo.

REM Step 1: Install backend dependencies
echo [INFO] Installing backend dependencies...
cd backend
npm install --production
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
echo [INFO] Backend dependencies installed successfully
echo.

REM Step 2: Install frontend dependencies
echo [INFO] Installing frontend dependencies...
cd ..\frontend
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)
echo [INFO] Frontend dependencies installed successfully
echo.

REM Step 3: Build frontend for production
echo [INFO] Building frontend for production...
npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)
echo [INFO] Frontend build completed successfully
echo.

REM Step 4: Create production environment file if it doesn't exist
cd ..\backend
if not exist ".env" (
    echo [WARNING] No .env file found. Creating from .env.production template...
    copy .env.production .env
    echo [WARNING] Please update the .env file with your actual production values!
) else (
    echo [INFO] .env file already exists
)
echo.

REM Step 5: Create uploads directory
echo [INFO] Creating uploads directory...
if not exist "uploads" mkdir uploads
echo.

REM Step 6: Display deployment summary
cd ..
echo 📋 Deployment Summary:
echo ✅ Backend dependencies installed
echo ✅ Frontend built for production
echo ✅ Environment file prepared
echo ✅ Upload directory created
echo.
echo ⚠️  Next Steps:
echo 1. Update backend\.env with your actual database credentials
echo 2. Update frontend API URL in src\services\api.js if needed
echo 3. Upload files to your cPanel hosting
echo 4. Configure Node.js app in cPanel
echo 5. Set up MySQL database
echo 6. Test the deployment
echo.
echo 📚 For detailed instructions, see CPANEL_DEPLOYMENT_GUIDE.md
echo 🎉 Deployment preparation completed successfully!
echo.
echo 🔗 Quick Links:
echo    - Frontend build: .\frontend\build\
echo    - Backend files: .\backend\
echo    - Environment config: .\backend\.env
echo    - Deployment guide: .\CPANEL_DEPLOYMENT_GUIDE.md
echo.
pause