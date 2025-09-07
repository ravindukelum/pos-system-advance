#!/bin/bash

# QOrder POS System - cPanel Deployment Script
# This script automates the deployment process for cPanel hosting

echo "🚀 Starting QOrder POS System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 14+ before proceeding."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm before proceeding."
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Step 1: Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
if npm install --production; then
    print_status "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Step 2: Install frontend dependencies and build
print_status "Installing frontend dependencies..."
cd ../frontend
if npm install; then
    print_status "Frontend dependencies installed successfully"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

# Step 3: Build frontend for production
print_status "Building frontend for production..."
if npm run build; then
    print_status "Frontend build completed successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

# Step 4: Create production environment file if it doesn't exist
cd ../backend
if [ ! -f ".env" ]; then
    print_warning "No .env file found. Creating from .env.production template..."
    cp .env.production .env
    print_warning "Please update the .env file with your actual production values!"
else
    print_status ".env file already exists"
fi

# Step 5: Create uploads directory
print_status "Creating uploads directory..."
mkdir -p uploads
chmod 755 uploads

# Step 6: Set proper permissions
print_status "Setting file permissions..."
chmod 644 .env
chmod 755 ../frontend/build

# Step 7: Display deployment summary
cd ..
print_status "\n📋 Deployment Summary:"
echo "✅ Backend dependencies installed"
echo "✅ Frontend built for production"
echo "✅ Environment file prepared"
echo "✅ Upload directory created"
echo "✅ File permissions set"

print_warning "\n⚠️  Next Steps:"
echo "1. Update backend/.env with your actual database credentials"
echo "2. Update frontend API URL in src/services/api.js if needed"
echo "3. Upload files to your cPanel hosting"
echo "4. Configure Node.js app in cPanel"
echo "5. Set up MySQL database"
echo "6. Test the deployment"

print_status "\n📚 For detailed instructions, see CPANEL_DEPLOYMENT_GUIDE.md"
print_status "🎉 Deployment preparation completed successfully!"

echo "\n🔗 Quick Links:"
echo "   - Frontend build: ./frontend/build/"
echo "   - Backend files: ./backend/"
echo "   - Environment config: ./backend/.env"
echo "   - Deployment guide: ./CPANEL_DEPLOYMENT_GUIDE.md"