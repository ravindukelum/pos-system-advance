# efix solution POS System - cPanel Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the efix solution POS System on a cPanel hosting environment.

## Prerequisites
- cPanel hosting account with Node.js support
- MySQL database access
- Domain or subdomain configured
- SSH access (recommended) or File Manager access
- Node.js version 14+ supported by your hosting provider

## Deployment Steps

### 1. Database Setup

#### Create MySQL Database
1. Log into cPanel
2. Navigate to **MySQL Databases**
3. Create a new database: `your_username_efix`
4. Create a database user: `your_username_dbuser`
5. Set a strong password for the database user
6. Add the user to the database with **ALL PRIVILEGES**
7. Note down the database details:
   - Database Name: `your_username_efix`
   - Database User: `your_username_dbuser`
   - Database Password: `[your_password]`
   - Database Host: `localhost`

### 2. File Upload

#### Option A: Using Git (Recommended)
1. Access cPanel Terminal or SSH
2. Navigate to your domain's root directory:
   ```bash
   cd public_html
   ```
3. Clone the repository:
   ```bash
   git clone [your-repo-url] efix-solution
cd efix-solution
   git checkout cpanel-deployment
   ```

#### Option B: Using File Manager
1. Download the project as ZIP from GitHub
2. Extract the ZIP file
3. Upload all files to `public_html/efix-solution/` using cPanel File Manager

### 3. Backend Configuration

#### Install Backend Dependencies
1. Navigate to the backend directory:
   ```bash
   cd public_html/efix-solution/backend
   ```
2. Install dependencies:
   ```bash
   npm install --production
   ```

#### Configure Environment Variables
1. Copy the production environment file:
   ```bash
   cp .env.production .env
   ```
2. Edit the `.env` file with your actual values:
   ```bash
   nano .env
   ```
3. Update the following variables:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_USER=your_cpanel_username_dbuser
   DB_PASSWORD=your_actual_database_password
   DB_NAME=your_cpanel_username_efix
   
   # JWT Secret (Generate a strong random string)
   JWT_SECRET=your_super_secure_jwt_secret_key_here
   
   # CORS Configuration
   CORS_ORIGIN=https://yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   
   # Session Secret (Generate another strong random string)
   SESSION_SECRET=your_session_secret_key_here
   ```

### 4. Frontend Configuration

#### Build Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update the API base URL in `src/services/api.js`:
   ```javascript
   const API_BASE_URL = 'https://yourdomain.com/api';
   ```
4. Build the production version:
   ```bash
   npm run build
   ```

#### Deploy Frontend Files
1. Copy built files to the web root:
   ```bash
   cp -r build/* ../../
   ```
2. Ensure the `.htaccess` file is in the root directory for React routing

### 5. Node.js Application Setup

#### Configure Node.js App in cPanel
1. Go to cPanel → **Node.js Apps**
2. Click **Create Application**
3. Configure:
   - **Node.js Version**: Select latest available (14+)
   - **Application Mode**: Production
   - **Application Root**: `efix-solution/backend`
   - **Application URL**: `yourdomain.com/api` (or subdomain)
   - **Application Startup File**: `server.js`
4. Click **Create**

#### Set Environment Variables in cPanel
1. In the Node.js app settings, add environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (or as assigned by hosting)
   - Add all variables from your `.env` file

### 6. Database Initialization

#### Run Database Migrations
1. Start the Node.js application
2. The application will automatically create necessary tables on first run
3. Check the application logs for any database connection issues

#### Create Default Admin User
The system will create default users on first startup:
- **Admin**: username: `admin`, password: `admin123`
- **Manager**: username: `manager`, password: `manager123`
- **Cashier**: username: `cashier`, password: `cashier123`

**⚠️ Important**: Change these default passwords immediately after first login!

### 7. SSL Configuration

#### Enable SSL Certificate
1. Go to cPanel → **SSL/TLS**
2. Install SSL certificate (Let's Encrypt recommended)
3. Force HTTPS redirects
4. Update all URLs in configuration to use `https://`

### 8. Final Configuration

#### Update API Endpoints
1. Ensure frontend is pointing to correct backend URL
2. Test all API endpoints:
   - `https://yourdomain.com/api/auth/login`
   - `https://yourdomain.com/api/inventory`
   - `https://yourdomain.com/api/sales`

#### Configure File Permissions
```bash
chmod 755 public_html/efix-solution
chmod 644 public_html/efix-solution/backend/.env
chmod -R 755 public_html/efix-solution/backend/uploads
```

## Testing Deployment

### 1. Backend API Test
Test the backend API:
```bash
curl https://yourdomain.com/api/health
```

### 2. Frontend Test
1. Visit `https://yourdomain.com`
2. Verify the login page loads
3. Test login with default credentials
4. Check browser console for any errors

### 3. Database Connection Test
1. Try logging in with default admin credentials
2. Navigate to inventory management
3. Add a test product
4. Verify data persistence

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
- Verify database credentials in `.env`
- Check if database user has proper privileges
- Ensure database exists and is accessible

#### 2. Node.js App Won't Start
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check application logs in cPanel

#### 3. Frontend 404 Errors
- Ensure `.htaccess` file is in the correct location
- Verify React build was successful
- Check file permissions

#### 4. CORS Errors
- Update `CORS_ORIGIN` in backend `.env`
- Ensure frontend and backend URLs match
- Check SSL configuration

#### 5. File Upload Issues
- Create `uploads` directory in backend
- Set proper permissions: `chmod 755 uploads`
- Check `MAX_FILE_SIZE` configuration

### Log Files
- Backend logs: Check cPanel Node.js app logs
- Frontend errors: Browser developer console
- Server errors: cPanel Error Logs

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files to version control
- Use strong, unique passwords and secrets
- Regularly rotate JWT and session secrets

### 2. Database Security
- Use strong database passwords
- Limit database user privileges
- Regular database backups

### 3. File Permissions
- Restrict access to sensitive files
- Secure upload directories
- Regular security updates

## Maintenance

### Regular Tasks
1. **Database Backups**: Schedule regular MySQL backups
2. **Log Monitoring**: Check application logs regularly
3. **Security Updates**: Keep Node.js and dependencies updated
4. **Performance Monitoring**: Monitor application performance

### Updates
1. Pull latest changes from Git
2. Run `npm install` for new dependencies
3. Rebuild frontend if needed
4. Restart Node.js application

## Support

For technical support or issues:
1. Check the troubleshooting section above
2. Review application logs
3. Contact your hosting provider for server-specific issues
4. Submit issues to the project repository

---

**Note**: This guide assumes a standard cPanel hosting environment. Some steps may vary depending on your specific hosting provider's configuration.