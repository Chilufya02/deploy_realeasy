# RealEasy - Property Management System

![RealEasy Logo](media/image1.jpeg)

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Payment Simulation](#payment-simulation)
- [Use Cases](#use-cases)
- [Project Timeline](#project-timeline)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

## 🏠 Overview

RealEasy is a comprehensive web-based property management platform designed to digitize and streamline rental property operations. It bridges the gap between landlords and tenants by providing an integrated solution for lease management, rent collection, and maintenance tracking.

### Key Benefits

- **Time-Saving**: Automates routine tasks and eliminates manual record-keeping
- **Error Reduction**: Minimizes mistakes through digital workflows
- **Transparency**: Provides clear visibility for both landlords and tenants
- **Accessibility**: Affordable solution for small to medium-scale property managers

## 🎯 Problem Statement

Property management today relies heavily on manual record-keeping and disjointed communication channels, resulting in:

- Operational delays and frequent errors
- Time wastage for landlords managing multiple properties
- Poor visibility and slow response times for tenant concerns
- Lack of accessible, unified solutions for streamlining property management processes

Despite growing urban rental demand, many small landlords lack affordable digital tools, leaving both parties frustrated and inefficient.

## ✨ Features

### Core Features (In Scope)

#### For Landlords

- **Property Management Dashboard**
  - Add, edit, and delete property listings
  - Upload property images (main and gallery)
  - Images are automatically optimized on upload for faster load times
  - View all properties at a glance
- **Tenant Management**

  - Assign tenants to properties
  - View tenant directory
  - Manage tenant accounts

- **Financial Management**

  - View payment dashboard with real-time updates
  - Track rent payments and outstanding balances
  - Generate financial reports

- **Lease Management**

  - Digital lease creation and generation
  - Auto-generate PDF lease documents from tenant and property details (inspired by Innago)
  - Includes industry-standard clauses for rent, security deposits, utilities, maintenance, termination, and signatures
  - Download signed leases

- **Maintenance Handling**
  - Receive and review maintenance requests
  - Approve or reject requests
  - Track maintenance status

#### For Tenants

- **Property Access**
  - View assigned property details
  - Access property images and information
- **Payment Portal**

  - Make online rent payments using a simulated service
  - View payment history and receipts

- **Maintenance Requests**

  - Submit repair requests
  - Track request status
  - Receive updates on maintenance progress

- **Document Management**
  - Download lease agreements
  - Access important property documents

#### System Features

- **Automated Notifications**
  - Maintenance status updates
  - Lease expiry notices
- **Security**
  - Role-based access control
  - Secure authentication (JWT)
  - HTTPS encryption

### Out of Scope

- Mobile application development (focusing on responsive web design)
- AI-driven pricing analytics
- Enterprise-scale multi-tenant support
- Complex accounting features

## 🛠️ Technology Stack

### Frontend

- **Framework**: React.js
- **Styling**: CSS3 / Responsive Design
- **State Management**: React Hooks

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: JWT (JSON Web Tokens)

### Database

- **Primary Database**: MySQL

### Additional Technologies

- **PDF Generation**: PDFKit or similar library
- **Payment Processing**: Simulated service for development
- **Email Service**: NodeMailer
- **File Storage**: Cloud storage for images
- **Security**: HTTPS, bcrypt for password hashing

## 🏗️ System Architecture

The system follows a layered architecture approach:

```
┌─────────────────────────────────────────────┐
│          User Interface Layer               │
│  ┌───────────────┐    ┌─────────────────┐  │
│  │   Landlord    │    │     Tenant      │  │
│  │   Dashboard   │    │    Dashboard    │  │
│  └───────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│         Business Logic Layer                │
│  • Authentication & Authorization           │
│  • Property Assignment Logic                │
│  • Rent Payment Processing                  │
│  • Lease Generation                         │
│  • Notification Service                     │
│  • Access Control                           │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│         Data Access Layer                   │
│  • Database queries                         │
│  • Data validation                          │
│  • Caching layer                            │
└─────────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────────┐
│            Data Store                       │
│  • User data                                │
│  • Property information                     │
│  • Payment records                          │
│  • Maintenance logs                         │
└─────────────────────────────────────────────┘
```

## 💻 Installation

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn package manager
- MySQL database
- Git

### Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/realeasy.git
   cd realeasy
   ```

2. **Install dependencies**

   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the backend directory:

  ```env
  PORT=5000
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=your_password
  DB_NAME=realeasy
  JWT_SECRET=your_jwt_secret_key
  JWT_EXPIRE=7d
  BCRYPT_ROUNDS=12
  EMAIL_SERVICE_API_KEY=your_email_api_key
  ```

  > Payments are simulated by the application; no external gateway API keys are needed.

4. **Database Setup**

  ```bash
  # Create the database and tables
  mysql -u root -p realeasy < backend/database.sql
  ```

5. **Start the application**

   ```bash
   # Start backend server
   cd backend
   npm run dev

   # Start frontend (in a new terminal)
   cd frontend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

### API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET`  | `/api/properties/:id` | Retrieve a single property |
| `GET`  | `/api/tenants/:id` | Retrieve a single tenant |

## 📱 Usage

### For Landlords

1. Register for a landlord account
2. Add your properties with details and images
3. Assign tenants to properties
4. Generate and manage lease agreements
5. Monitor rent payments and maintenance requests

### For Tenants

1. Register for a tenant account
2. View your assigned property
3. Make rent payments online
4. Submit maintenance requests
5. Download lease documents

## 🧪 Payment Simulation

RealEasy now uses a built-in payment simulator for all payment flows. The simulator mimics card, Airtel Money, and MTN Money transactions, randomly succeeding or failing and **cannot** move real funds.

### Test Cards

| Brand | Card Number | Expiry | CVV |
|-------|-------------|--------|-----|
| Visa | 4242 4242 4242 4242 | 12/25 | 123 |
| MasterCard | 5555 5555 5555 4444 | 12/25 | 123 |
| Amex | 3782 822463 10005 | 12/25 | 1234 |

### Test Mobile Money Numbers

| Service | Country Code | Phone Number |
|---------|--------------|--------------|
| Airtel Money | +250 | +250 78 000 0000 |
| Airtel Money | +233 | +233 26 000 0000 |
| MTN Money | +256 | +256 76 000 0000 |
| MTN Money | +233 | +233 54 000 0000 |

> These numbers and cards are provided for simulation only and will not process real payments.

## 📑 Use Cases

### Landlord Use Cases

1. **Account Management**: Register, login/logout
2. **Property Management**: Create, edit, delete listings; upload images
3. **Tenant Management**: Assign tenants, view directory
4. **Financial Management**: View payments
5. **Maintenance**: Approve/reject requests
6. **Documentation**: Generate lease agreements

### Tenant Use Cases

1. **Account Access**: Register, login/logout
2. **Property Viewing**: Access property details and images
3. **Payments**: Make rent payments, view history
4. **Maintenance**: Submit and track requests
5. **Documentation**: Download lease agreements
6. **Notifications**: Receive alerts and updates

### System Administrator Use Cases

1. **User Management**: Manage landlord/tenant accounts
2. **Reporting**: Generate system metrics and usage reports

### Automated Services

1. **Status Updates**: Maintenance progress notifications
2. **Lease Alerts**: Expiry notifications

## 📅 Project Timeline

### Inception Phase
- **Week 1 (April 21-27, 2025) – Initial Planning**
  - High-level requirements specification
  - Risk assessment & mitigation strategies
  - Feasibility study – technical, operational & economic

### Elaboration Phase
- **Week 2-3 (April 28-May 11, 2025) – E1: Architecture & Core Analysis**
  - 30% Use Cases Detailed (7 use cases)
  - Domain model (complete)
  - System architecture design
  - Technology stack finalization – backend
  - Technology stack finalization – frontend
- **Week 4 (May 12-18, 2025) & Week 5 (June 9-15, 2025) – E2: Complete Analysis**
  - Remaining 70% Use Cases Detailed
  - Non-functional requirements specification
  - Development environment setup
- **Exam Break: May 19 – June 8, 2025**

### Construction Phase
- **Week 6-7 (June 16-29, 2025) – C1: User Management & Authentication**
  - Welcome page, registration/login UI design – *Chilufya*
  - Security implementation (JWT tokens) – *Lawrence*
  - Authentication and authorization framework – *Lawrence*
  - Database setup and initial tables – *Chilufya*
- **Week 8-9 (June 30-July 13, 2025) – C2: Property Management Core**
  - Property CRUD operations (backend) – *Lawrence*
  - Property image upload functionality (backend) – *Chilufya*
  - Landlord dashboard – *Lawrence*
  - Property assignment to tenants – *Chilufya*
- **Week 10-11 (July 14-27, 2025) – C3: Maintenance & Notifications**
  - Maintenance request submission system – *Chilufya*
  - Maintenance request approval/rejection workflow – *Lawrence*
  - Maintenance status tracking – *Chilufya*
  - Notification system & lease expiry alerts – *Lawrence*
  - Maintenance update notifications – *Lawrence*
- **Week 12-13 (July 28-August 10, 2025) – C4: Lease & Payment System**
  - Lease agreement management – *Lawrence*
  - Payment simulation service – *Chilufya*
  - Rent payment processing – *Lawrence*
  - Payment history tracking – *Chilufya*
  - Payment dashboard for landlords – *Lawrence*
  - Automated payment receipts – *Chilufya*

### Transition Phase
- **Week 14 (August 11-17, 2025) – T1: Integration & Testing**
  - Performance testing – *Lawrence*
  - Bug fixes & optimization – backend – *Lawrence*
  - Bug fixes & optimization – frontend – *Chilufya*
- **Week 15 (August 18-24, 2025) – T2: Deployment & Documentation**
  - Final user documentation
  - Final project report
## 🤝 Contributing

We welcome contributions to RealEasy! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Use ES6+ JavaScript features
- Follow React best practices
- Write clean, commented code
- Include unit tests for new features

## 👥 Team

- **Lawrence Chitandula** - 2021476987
- **Chilufya Chulu** - 2021504344
- **Supervisor**: Mr. Martin Phiri

### Contact

- University of Zambia
- School of Natural and Applied Sciences
- Department of Computing and Informatics

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- University of Zambia, Department of Computing and Informatics
- Mr. Martin Phiri for project supervision
- Open source community for the amazing tools and libraries

---

**Project Status**: In Development (Started: April 2025)

For questions or support, please contact the development team through the University of Zambia, Department of Computing and Informatics.
