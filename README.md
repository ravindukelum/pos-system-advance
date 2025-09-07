# Comprehensive Point of Sale (POS) System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8+-orange.svg)](https://mysql.com/)

A modern, full-featured Point of Sale system built with React and Node.js, designed for real-world business operations. Features comprehensive inventory management, sales processing, customer management, employee tracking, and advanced reporting capabilities.

## 🚀 Live Demo

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5000

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with refresh tokens
- Role-based access control (Admin, Manager, Cashier, Employee)
- Password security with bcrypt hashing
- Protected routes and API endpoints

### 📦 Inventory Management
- Product catalog with categories
- Batch tracking and expiry date management
- Reorder point alerts
- Barcode/QR code generation and scanning
- SKU-based item lookup

### 💰 Sales Processing
- Multi-item transactions
- Tax calculation and management
- Discount application
- Receipt generation and printing
- Invoice management

### 👥 Customer Management
- Customer profiles and contact information
- Loyalty points system
- Purchase history tracking
- Customer analytics and insights

### 👨‍💼 Employee Management
- Time tracking with clock in/out
- Commission calculation
- Performance monitoring
- Attendance summaries

### 💳 Payment Processing
- Multiple payment methods (Cash, Card, Digital, Transfer)
- Stripe integration for card payments
- Refund processing
- Transaction history

### 📊 Reporting & Analytics
- Sales reports with date filtering
- Product performance analytics
- Customer insights
- Financial summaries
- Tax reporting

### 🏢 Multi-Location Support
- Location-based inventory management
- Inter-location transfers
- Location-specific reporting

### 🔌 Third-Party Integrations
- QuickBooks accounting integration
- WooCommerce/Shopify sync
- Mailchimp marketing automation
- Webhook support

### 📱 Progressive Web App (PWA)
- Offline functionality
- Service worker caching
- Mobile-responsive design
- Dark/Light theme support

## 🛠️ Technology Stack

### Frontend
- **React 18+** - Modern UI library
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **React Hot Toast** - Notifications
- **Heroicons** - Beautiful icons

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web application framework
- **MySQL** - Relational database
- **JWT** - Authentication tokens
- **Bcrypt** - Password hashing
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

### Additional Tools
- **Service Workers** - PWA functionality
- **IndexedDB** - Offline data storage
- **QR Code Generation** - Product and receipt codes
- **Thermal Printer Support** - Receipt printing

## 📋 Prerequisites

- Node.js 18+ and npm
- MySQL 8+
- Git

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/qorder-pos-system.git
cd qorder-pos-system
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Database Setup
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE pos_system_local;
EXIT;

# Tables will be created automatically when you start the server
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
```

### 5. Environment Configuration

Create `backend/.env` file:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pos_system_local

CORS_ORIGIN=http://localhost:3001

JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
```

## 🏃‍♂️ Running the Application

### Development Mode

1. **Start Backend Server**:
```bash
cd backend
node server.js
# Server runs on http://localhost:5000
```

2. **Start Frontend Development Server**:
```bash
cd frontend
npm start
# Application runs on http://localhost:3001
```

### Production Mode

1. **Build Frontend**:
```bash
cd frontend
npm run build
```

2. **Deploy Backend**: Configure your production environment variables and deploy to your preferred hosting platform.

## 🔑 Default Credentials

**Admin Account**:
- Username: `admin`
- Password: `admin123`

**Demo Accounts**:
- Manager: `manager` / `manager123`
- Cashier: `cashier` / `cashier123`

## 📁 Project Structure

```
qorder-pos-system/
├── backend/
│   ├── database/
│   │   └── db.js              # Database connection and schema
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── routes/
│   │   ├── auth.js             # Authentication routes
│   │   ├── inventory.js        # Inventory management
│   │   ├── sales.js            # Sales processing
│   │   ├── customers.js        # Customer management
│   │   ├── employees.js        # Employee management
│   │   ├── payments.js         # Payment processing
│   │   ├── reports.js          # Analytics and reporting
│   │   ├── locations.js        # Multi-location support
│   │   └── integrations.js     # Third-party integrations
│   ├── server.js               # Main server file
│   └── package.json
├── frontend/
│   ├── public/
│   │   ├── sw.js               # Service worker
│   │   └── manifest.json       # PWA manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.js       # Main layout component
│   │   │   ├── ProtectedRoute.js # Route protection
│   │   │   └── BarcodeScanner.js # Barcode scanning
│   │   ├── contexts/
│   │   │   ├── AuthContext.js  # Authentication state
│   │   │   └── ThemeContext.js # Theme management
│   │   ├── pages/
│   │   │   ├── Dashboard.js    # Main dashboard
│   │   │   ├── Sales.js        # Sales interface
│   │   │   ├── Inventory.js    # Inventory management
│   │   │   ├── Customers.js    # Customer management
│   │   │   ├── Employees.js    # Employee management
│   │   │   ├── Payments.js     # Payment processing
│   │   │   └── Reports.js      # Analytics dashboard
│   │   ├── services/
│   │   │   └── api.js          # API client
│   │   ├── utils/
│   │   │   └── offline.js      # Offline functionality
│   │   └── App.js              # Main application component
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Inventory
- `GET /api/inventory` - Get all products
- `POST /api/inventory` - Create product
- `PUT /api/inventory/:id` - Update product
- `DELETE /api/inventory/:id` - Delete product

### Sales
- `GET /api/sales` - Get all sales
- `POST /api/sales` - Create new sale
- `GET /api/sales/:id` - Get sale by ID

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer

### Reports
- `GET /api/reports/sales` - Sales analytics
- `GET /api/reports/products` - Product performance
- `GET /api/reports/customers` - Customer insights

## 🚀 Deployment

### Frontend Deployment Options
- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop build folder
- **AWS S3 + CloudFront**: Upload build to S3

### Backend Deployment Options
- **Railway**: Connect GitHub repository
- **Heroku**: `git push heroku main`
- **DigitalOcean**: Deploy via App Platform

### Database Options
- **AWS RDS MySQL**
- **Google Cloud SQL**
- **PlanetScale**
- **DigitalOcean Managed Databases**

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

## 📱 PWA Features

- **Offline Support**: Continue working without internet
- **Background Sync**: Sync data when connection returns
- **Push Notifications**: Real-time updates
- **Install Prompt**: Add to home screen

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/YOUR_USERNAME/qorder-pos-system/issues) page
2. Create a new issue with detailed description
3. Join our community discussions

## 🙏 Acknowledgments

- React team for the amazing framework
- Express.js community for the robust backend framework
- Tailwind CSS for the beautiful styling system
- MySQL team for the reliable database

---

**Built with ❤️ for modern businesses**
