# QOrder POS System - Quick Setup Guide

## 🚀 Quick Start for cPanel Deployment

### Prerequisites Checklist
- [ ] cPanel hosting with Node.js support (v14+)
- [ ] MySQL database access
- [ ] Domain/subdomain configured
- [ ] SSH access or File Manager

### 1. Download & Extract
```bash
# Option A: Git Clone (Recommended)
git clone [your-repo-url] qorder
cd qorder
git checkout cpanel-deployment

# Option B: Download ZIP and extract to public_html/qorder/
```

### 2. Run Deployment Script
```bash
# Linux/Mac
./deploy.sh

# Windows
deploy.bat
```

### 3. Configure Database
1. **cPanel → MySQL Databases**
2. Create database: `username_qorder`
3. Create user: `username_dbuser`
4. Add user to database with ALL PRIVILEGES

### 4. Update Configuration
```bash
# Edit backend environment
nano backend/.env
```
Update these values:
```env
DB_USER=your_cpanel_username_dbuser
DB_PASSWORD=your_database_password
DB_NAME=your_cpanel_username_qorder
JWT_SECRET=generate_random_string_here
CORS_ORIGIN=https://yourdomain.com
```

### 5. Setup Node.js App
1. **cPanel → Node.js Apps**
2. **Create Application**:
   - Root: `qorder/backend`
   - Startup: `server.js`
   - Mode: Production

### 6. Deploy Frontend
```bash
# Copy built files to web root
cp -r frontend/build/* ../
```

### 7. Test Deployment
- Visit: `https://yourdomain.com`
- Login: `admin` / `admin123`
- **Change default passwords immediately!**

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection failed | Check credentials in `.env` |
| Node.js won't start | Verify Node.js version & dependencies |
| 404 errors | Ensure `.htaccess` in root directory |
| CORS errors | Update `CORS_ORIGIN` in backend `.env` |

## 📞 Support
- 📖 Full Guide: `CPANEL_DEPLOYMENT_GUIDE.md`
- 🐛 Issues: Check application logs
- 💬 Help: Contact hosting provider for server issues

---
**⚠️ Security Note**: Change all default passwords after first login!