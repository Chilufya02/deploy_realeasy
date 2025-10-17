-- SQL schema for RealEasy landlord dashboard
CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  rent DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Vacant',
  tenant_id INT DEFAULT NULL,
  landlord_id INT NOT NULL,
  INDEX idx_rent (rent),
  INDEX idx_type (type),
  INDEX idx_address (address),
  FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20),
  property_id INT,
  balance DECIMAL(10,2) DEFAULT 0,
  last_payment DATE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT,
  property_id INT,
  issue TEXT NOT NULL,
  priority VARCHAR(20),
  status VARCHAR(50) DEFAULT 'Pending',
  image VARCHAR(255),
  date DATE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT,
  property_id INT,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Received',
  method VARCHAR(50),
  reference VARCHAR(255),
  gateway_status VARCHAR(50),
  date DATE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);

-- Lease documents tracking
CREATE TABLE IF NOT EXISTS leases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  tenant_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  document_path VARCHAR(255),
  signed_document_path VARCHAR(255),
  landlord_signature_path VARCHAR(255),
  tenant_signature_path VARCHAR(255),
  provider_envelope_id VARCHAR(255),
  start_date DATE,
  end_date DATE,
  due_date DATE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('landlord', 'tenant') NOT NULL,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login attempts for rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_time (email, created_at),
  INDEX idx_ip_time (ip_address, created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
   id INT AUTO_INCREMENT PRIMARY KEY,
   tenant_id INT NOT NULL,
   type VARCHAR(50) NOT NULL,
   title VARCHAR(255) NOT NULL,
   message TEXT NOT NULL,
   date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   `read` BOOLEAN DEFAULT FALSE,
   FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

