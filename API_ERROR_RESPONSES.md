# API Error Response Reference

This document lists all possible error responses from the backend API to help with frontend development.

## Error Response Format

All errors follow this standardized JSON format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {
      // Additional error-specific details
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## HTTP Status Codes Overview

- **400** - Bad Request (Validation errors, malformed data)
- **401** - Unauthorized (Authentication required/failed)
- **403** - Forbidden (Authorization failed)
- **404** - Not Found (Resource doesn't exist)
- **409** - Conflict (Duplicate resources)
- **422** - Unprocessable Entity (Business logic violations)
- **429** - Too Many Requests (Rate limiting)
- **500** - Internal Server Error (Unexpected errors)
- **502** - Bad Gateway (External service errors)

---

## 400 - Validation Errors

### Missing Required Fields
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required fields are missing",
    "details": {
      "field": null,
      "validationDetails": {
        "missingFields": ["email", "password", "fullName"]
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** All POST/PUT endpoints
**Triggers:** Missing required fields in request body

### Invalid Format Errors
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR", 
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "validationDetails": {
        "expectedFormat": null
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Common Format Errors:**
- `Invalid email format` (field: "email")
- `Invalid phone format` (field: "phone", expectedFormat: "Vietnamese phone number format")
- `Invalid dateOfBirth format` (field: "dateOfBirth", expectedFormat: "YYYY-MM-DD")
- `Invalid expiryDate format` (field: "expiryDate", expectedFormat: "YYYY-MM-DD")

### Invalid Enum Values
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid role value", 
    "details": {
      "field": "role",
      "validationDetails": {
        "providedValue": "admin",
        "validOptions": ["pharmacist", "client", "superuser"]
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Common Enum Errors:**
- **role**: `["pharmacist", "client", "superuser"]`
- **gender**: `["male", "female", "other"]`
- **status** (products): `["active", "inactive", "out_of_stock"]`

### Invalid Number Values
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "priceValue must be a valid number (minimum: 0)",
    "details": {
      "field": "priceValue",
      "validationDetails": {
        "providedValue": -10,
        "min": 0,
        "max": null
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Common Number Fields:**
- **priceValue**: minimum 0
- **stockQuantity**: minimum 0
- **pagination**: page >= 1, limit 1-100

### File Upload Errors
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required fields are missing",
    "details": {
      "field": null,
      "validationDetails": {
        "missingFields": ["file"]
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Database Constraint Violations

#### Unique Constraint
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_ENTRY",
    "message": "A record with this value already exists",
    "details": {
      "constraint": "users_email_key"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Foreign Key Constraint
```json
{
  "success": false,
  "error": {
    "code": "REFERENCE_ERROR",
    "message": "Referenced record does not exist", 
    "details": {
      "constraint": "fk_user_id"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Invalid Input Format (Database)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT_FORMAT",
    "message": "Invalid input format for database operation",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 401 - Authentication Errors

### Invalid Login Credentials
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid login credentials",
    "details": {
      "remainingAttempts": 3,
      "blocked": false
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** `POST /auth/user/login`

### Rate Limited Login
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED", 
    "message": "Too many failed login attempts",
    "details": {
      "blocked": true,
      "secondsRemaining": 300,
      "retryAfter": 300
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** `POST /auth/user/login`
**Triggers:** 5+ failed login attempts

### Incorrect Current Password
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Current currentPassword is incorrect",
    "details": {
      "field": "currentPassword"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** `POST /auth/user/change-password`

### Session Required
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED", 
    "message": "Authentication required to access this resource",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** Protected routes requiring authentication

### Challenge Expired
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Authentication challenge has expired", 
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** Superuser WebAuthn flows

### Invalid JWT Token
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid authentication token",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 403 - Authorization Errors

### Insufficient Permissions
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_FAILED",
    "message": "Insufficient permissions to access this resource", 
    "details": {
      "requiredRole": null,
      "userRole": null
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Role Required
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_FAILED",
    "message": "superuser role required for this action",
    "details": {
      "requiredRole": "superuser", 
      "userRole": "client"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 404 - Not Found Errors

### User Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User with identifier 'user123' not found",
    "details": {
      "resource": "User",
      "identifier": "user123"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** Any user-related endpoint with invalid user ID

### Product Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND", 
    "message": "Product with identifier '456' not found",
    "details": {
      "resource": "Product",
      "identifier": "456"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** `GET /products/:id`, `PUT /products/:id`, `DELETE /products/:id`

### Staff Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Staff with identifier 'staff789' not found", 
    "details": {
      "resource": "Staff",
      "identifier": "staff789"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** Staff management endpoints

### Route Not Found
```json
{
  "success": false,
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "Route GET /nonexistent not found",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Triggers:** Accessing non-existent API endpoints

---

## 409 - Conflict Errors

### Duplicate Email
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "An account with this email already exists",
    "details": {
      "conflictType": "DUPLICATE_EMAIL",
      "conflictDetails": {
        "email": "user@example.com"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** `POST /auth/user/register`, staff creation

### Duplicate SKU
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "A product with this SKU already exists",
    "details": {
      "conflictType": "DUPLICATE_SKU", 
      "conflictDetails": {
        "sku": "PROD123456"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** `POST /products`, `PUT /products/:id`

### Resource Already Taken
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "SKU is already taken",
    "details": {
      "conflictType": "RESOURCE_TAKEN",
      "conflictDetails": {
        "resourceType": "SKU",
        "value": "EXISTING123"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 422 - Business Logic Errors

### Password Requirements
```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_LOGIC_ERROR",
    "message": "Password does not meet security requirements",
    "details": {
      "businessRule": "PASSWORD_POLICY",
      "ruleDetails": {
        "requirements": ["Minimum 8 characters"],
        "currentLength": 5
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** Registration, password change

### Age Restrictions
```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_LOGIC_ERROR",
    "message": "Age must be at least 120 years",
    "details": {
      "businessRule": "AGE_RESTRICTION", 
      "ruleDetails": {
        "minAge": 120,
        "providedAge": 150
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Future Date Not Allowed
```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_LOGIC_ERROR",
    "message": "Date of birth cannot be in the future",
    "details": {
      "businessRule": "FUTURE_DATE_NOT_ALLOWED",
      "ruleDetails": {
        "field": "Date of birth"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Invalid Operations
```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_LOGIC_ERROR",
    "message": "Cannot delete product: product has active orders",
    "details": {
      "businessRule": "INVALID_OPERATION",
      "ruleDetails": {
        "operation": "delete product",
        "reason": "product has active orders"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 429 - Rate Limiting

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests, please try again later",
    "details": {
      "retryAfter": 60
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** All endpoints (global rate limiting)

---

## 500 - Internal Server Errors

### General Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Database Errors
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database operation failed",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 502 - External Service Errors

### S3 Upload Error
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "Failed to upload image with S3 storage service",
    "details": {
      "service": "AWS_S3",
      "serviceDetails": {
        "operation": "upload image",
        "originalError": "Network timeout"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Endpoints:** Image upload endpoints

### Database Connection Error
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR", 
    "message": "Database query operation failed",
    "details": {
      "service": "DATABASE",
      "serviceDetails": {
        "operation": "query",
        "originalError": "Connection timeout"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Authentication Service Error
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "Authentication service verification failed",
    "details": {
      "service": "AUTH_SERVICE", 
      "serviceDetails": {
        "operation": "verification",
        "originalError": "Service unavailable"
      }
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Special Cases

### File Upload Errors

#### File Too Large
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds the allowed limit",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Invalid JSON Payload
```json
{
  "success": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "Invalid JSON in request body",
    "details": null,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Frontend Error Handling Best Practices

### Error Code Categories
```javascript
const ErrorCategories = {
  VALIDATION: ['VALIDATION_ERROR'],
  AUTHENTICATION: ['AUTHENTICATION_FAILED', 'INVALID_TOKEN'],
  AUTHORIZATION: ['AUTHORIZATION_FAILED'],
  NOT_FOUND: ['NOT_FOUND', 'ROUTE_NOT_FOUND'],
  CONFLICT: ['CONFLICT_ERROR', 'DUPLICATE_ENTRY'],
  BUSINESS_LOGIC: ['BUSINESS_LOGIC_ERROR'],
  RATE_LIMITING: ['RATE_LIMITED'],
  SERVER: ['INTERNAL_SERVER_ERROR', 'DATABASE_ERROR'],
  EXTERNAL: ['EXTERNAL_SERVICE_ERROR'],
  FILE: ['FILE_TOO_LARGE', 'INVALID_JSON']
};
```

### Generic Error Handler Example
```javascript
function handleApiError(error) {
  const { status, data } = error.response;
  const { code, message, details } = data.error;

  switch (status) {
    case 400:
      return handleValidationError(code, message, details);
    case 401:
      return handleAuthenticationError(code, message, details);
    case 403:
      return handleAuthorizationError(code, message, details);
    case 404:
      return handleNotFoundError(code, message, details);
    case 409:
      return handleConflictError(code, message, details);
    case 422:
      return handleBusinessLogicError(code, message, details);
    case 429:
      return handleRateLimitError(code, message, details);
    case 500:
    case 502:
      return handleServerError(code, message, details);
    default:
      return handleUnknownError(error);
  }
}
```

### Specific Field Error Handling
```javascript
function handleValidationError(code, message, details) {
  if (details?.validationDetails?.missingFields) {
    // Highlight missing fields in form
    details.validationDetails.missingFields.forEach(field => {
      highlightField(field, 'This field is required');
    });
  }
  
  if (details?.field) {
    // Show field-specific error
    highlightField(details.field, message);
  }
}
```

This comprehensive error reference should give you everything you need to build robust error handling in your frontend! 🚀