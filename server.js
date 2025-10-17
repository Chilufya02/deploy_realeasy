const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env')
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  dotenv.config();
}

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

const propertiesRouter = require('./src/routes/properties');
const tenantsRouter = require('./src/routes/tenants');
const maintenanceRouter = require('./src/routes/maintenance');
const paymentsRouter = require('./src/routes/payments');
const authRouter = require('./src/routes/auth');
const leasesRouter = require('./src/routes/leases');
const notificationsRouter = require('./src/routes/notifications');
require('./src/cron');

app.use(express.json());
app.use(cookieParser());

// CORS configuration
const defaultOrigins = [
  'https://realeazy.site',
  'https://www.realeazy.site',
  'http://localhost:5173'
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : defaultOrigins;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const uploadsDirectory = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDirectory));

app.use('/api/properties', propertiesRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/leases', leasesRouter);
app.use('/api/notifications', notificationsRouter);

// Serve the React build when deploying in a single Node.js process
const buildDirectory = path.join(__dirname, 'public');

if (fs.existsSync(buildDirectory)) {
  app.use(express.static(buildDirectory));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }

    res.sendFile(path.join(buildDirectory, 'index.html'));
  });
}

// Standardized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
