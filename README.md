# Pharmacy Management System - OOP Refactored

This project has been refactored to follow Object-Oriented Programming (OOP) principles, providing better code organization, maintainability, and scalability.

## 🏗️ Architecture Overview

The codebase follows a layered architecture pattern with clear separation of concerns:

```
src/
├── core/           # Core utilities and base classes
├── models/         # Data models and business logic
├── controllers/    # HTTP request/response handlers
├── routes/         # Route definitions and middleware
├── app/           # Application configuration
└── config/        # Configuration files
```

## 📁 Directory Structure

### Core Classes (`src/core/`)

- **`Database.js`** - Database connection and query management
- **`Logger.js`** - Centralized logging functionality
- **`Validator.js`** - Input validation utilities
- **`Authenticator.js`** - Authentication and authorization logic

### Models (`src/models/`)

- **`Product.js`** - Product data model with CRUD operations

### Controllers (`src/controllers/`)

- **`ProductController.js`** - Handles product-related HTTP requests
- **`AuthController.js`** - Handles authentication-related HTTP requests

### Routes (`src/routes/`)

- **`ProductRoutes.js`** - Product route definitions
- **`AuthRoutes.js`** - Authentication route definitions

### Application (`src/app/`)

- **`App.js`** - Main application class with middleware and route setup

## 🎯 OOP Principles Implemented

### 1. Encapsulation
- Each class encapsulates its own data and methods
- Private methods and properties are properly scoped
- Clear interfaces between layers

### 2. Inheritance
- Base classes provide common functionality
- Specialized classes extend base functionality
- Code reuse through inheritance

### 3. Polymorphism
- Different route classes implement the same interface
- Controllers can handle different types of requests
- Flexible authentication methods

### 4. Abstraction
- Complex operations are abstracted into simple interfaces
- Database operations are abstracted through the Database class
- Validation logic is abstracted through the Validator class

## 🔧 Key Classes

### Database Class
```javascript
class Database {
    constructor() {
        this.pool = new Pool({...});
    }
    
    async query(text, params) { ... }
    async getClient() { ... }
    async close() { ... }
}
```

### Logger Class
```javascript
class Logger {
    log(level, message, data) { ... }
    info(message, data) { ... }
    error(message, error) { ... }
    logRequest(req, res, next) { ... }
}
```

### Validator Class
```javascript
class Validator {
    validateRequired(data, requiredFields) { ... }
    validateNumber(field, value, min, max) { ... }
    validateString(field, value, minLength, maxLength) { ... }
    validateEnum(field, value, validValues) { ... }
    validateDate(field, value, format) { ... }
}
```

### Product Model
```javascript
class Product {
    async create(productData) { ... }
    async update(id, updateData) { ... }
    async delete(id) { ... }
    async getById(id) { ... }
    async list(filters) { ... }
}
```

### Product Controller
```javascript
class ProductController {
    async createProduct(req, res) { ... }
    async updateProduct(req, res) { ... }
    async deleteProduct(req, res) { ... }
    async getProduct(req, res) { ... }
    async listProducts(req, res) { ... }
}
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database configuration
   ```

4. Start the server:
   ```bash
   npm start
   ```

## 📋 API Endpoints

### Products
- `GET /products/list` - List all products with pagination and filtering
- `GET /products/:id` - Get a specific product
- `POST /products/create` - Create a new product (requires authentication)
- `PUT /products/update/:id` - Update a product (requires authentication)
- `DELETE /products/delete/:id` - Delete a product (requires authentication)

### Authentication
- `GET /auth/session` - Get current session information
- `POST /auth/logout` - Logout current user

## 🔐 Authentication

The system supports multiple authentication levels:
- **Public routes** - No authentication required
- **User authentication** - Requires valid user session
- **Superuser/Pharmacist authentication** - Requires elevated privileges

## 🧪 Testing

Run tests with:
```bash
npm test
```

## 📝 Code Style

The codebase follows these OOP best practices:
- Single Responsibility Principle (SRP)
- Open/Closed Principle (OCP)
- Dependency Inversion Principle (DIP)
- Interface Segregation Principle (ISP)

## 🔄 Migration from Procedural Code

The original procedural code has been refactored to:

1. **Extract classes** from procedural functions
2. **Implement proper error handling** with try-catch blocks
3. **Add validation** through the Validator class
4. **Centralize logging** through the Logger class
5. **Separate concerns** into models, controllers, and routes
6. **Implement dependency injection** for better testability

## 🎨 Benefits of OOP Refactoring

1. **Maintainability** - Code is organized into logical classes
2. **Reusability** - Common functionality is shared through inheritance
3. **Testability** - Classes can be easily unit tested
4. **Scalability** - New features can be added without modifying existing code
5. **Readability** - Clear separation of concerns makes code easier to understand

## 🤝 Contributing

1. Follow the established OOP patterns
2. Add proper error handling and validation
3. Include logging for debugging
4. Write tests for new functionality
5. Update documentation as needed

## 📄 License

This project is licensed under the MIT License. 