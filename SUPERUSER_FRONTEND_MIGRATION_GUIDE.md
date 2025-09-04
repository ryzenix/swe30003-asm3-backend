# Superuser Frontend Migration Guide

## Overview

The superuser authentication endpoints have been migrated to use standardized error responses. This guide helps frontend developers update their code to handle the new error format.

## New Error Response Format

All superuser endpoints now return errors in this standardized format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional context-specific information
    },
    "timestamp": "2025-08-07T18:20:24.196Z"
  }
}
```

## Affected Endpoints

- `POST /auth/superuser/check-email`
- `GET /auth/superuser/session`
- `POST /auth/superuser/logout`
- `POST /auth/superuser/register-challenge`
- `POST /auth/superuser/register`
- `POST /auth/superuser/login-challenge`
- `POST /auth/superuser/login`

## Error Types and Codes

### 1. Validation Errors (400 Bad Request)

#### Missing Fields
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required fields are missing",
    "details": {
      "field": null,
      "validationDetails": {
        "missingFields": ["email", "fullName"]
      }
    },
    "timestamp": "2025-08-07T18:20:24.196Z"
  }
}
```

#### Invalid Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "validationDetails": {
        "expectedFormat": "valid email address"
      }
    },
    "timestamp": "2025-08-07T18:20:24.197Z"
  }
}
```

### 2. Authentication Errors (401 Unauthorized)

#### Challenge Expired
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Authentication challenge has expired",
    "details": null,
    "timestamp": "2025-08-07T18:20:24.198Z"
  }
}
```

#### Invalid Credentials
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid login credentials",
    "details": {
      "remainingAttempts": null,
      "blocked": false
    },
    "timestamp": "2025-08-07T18:20:24.198Z"
  }
}
```

### 3. Conflict Errors (409 Conflict)

#### Duplicate Email
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "An account with this email already exists",
    "details": {
      "conflictType": "DUPLICATE_EMAIL",
      "conflictDetails": {
        "email": "test@example.com"
      }
    },
    "timestamp": "2025-08-07T18:20:24.197Z"
  }
}
```

#### Passkey Already Registered
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "Passkey is already taken",
    "details": {
      "conflictType": "RESOURCE_TAKEN",
      "conflictDetails": {
        "resourceType": "Passkey",
        "value": "credential123"
      }
    },
    "timestamp": "2025-08-07T18:20:24.197Z"
  }
}
```

### 4. Not Found Errors (404 Not Found)

#### User/Credential Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User with identifier 'credential123' not found",
    "details": {
      "resource": "User",
      "identifier": "credential123"
    },
    "timestamp": "2025-08-07T18:20:24.198Z"
  }
}
```

## Migration Steps

### 1. Update Error Handling Functions

#### Before (Old Format)
```javascript
// Old error handling
const handleSuperuserError = (error) => {
  if (error.response?.data?.message) {
    showError(error.response.data.message);
  } else {
    showError('An unexpected error occurred');
  }
};
```

#### After (New Format)
```javascript
// New standardized error handling
const handleSuperuserError = (error) => {
  if (error.response?.data?.success === false) {
    const errorData = error.response.data.error;
    
    switch (errorData.code) {
      case 'VALIDATION_ERROR':
        handleValidationError(errorData);
        break;
      case 'AUTHENTICATION_FAILED':
        handleAuthenticationError(errorData);
        break;
      case 'CONFLICT_ERROR':
        handleConflictError(errorData);
        break;
      case 'NOT_FOUND':
        handleNotFoundError(errorData);
        break;
      default:
        showError(errorData.message || 'An unexpected error occurred');
    }
  } else {
    showError('An unexpected error occurred');
  }
};

// Specific error handlers
const handleValidationError = (errorData) => {
  if (errorData.details?.validationDetails?.missingFields) {
    const fields = errorData.details.validationDetails.missingFields.join(', ');
    showError(`Please fill in the following fields: ${fields}`);
  } else if (errorData.details?.field) {
    showError(`Invalid ${errorData.details.field}: ${errorData.message}`);
  } else {
    showError(errorData.message);
  }
};

const handleAuthenticationError = (errorData) => {
  if (errorData.message.includes('expired')) {
    showError('Your session has expired. Please try again.');
    // Optionally redirect to login
  } else {
    showError(errorData.message);
  }
};

const handleConflictError = (errorData) => {
  const conflictType = errorData.details?.conflictType;
  
  switch (conflictType) {
    case 'DUPLICATE_EMAIL':
      showError('This email is already registered. Please use a different email or try logging in.');
      break;
    case 'RESOURCE_TAKEN':
      showError('This passkey is already registered. Please use a different device or remove the existing passkey.');
      break;
    default:
      showError(errorData.message);
  }
};

const handleNotFoundError = (errorData) => {
  showError('The requested resource was not found. Please check your credentials and try again.');
};
```

### 2. Update API Call Examples

#### Email Check
```javascript
const checkEmail = async (email) => {
  try {
    const response = await axios.post('/auth/superuser/check-email', { email });
    return response.data;
  } catch (error) {
    handleSuperuserError(error);
    throw error;
  }
};
```

#### Registration Challenge
```javascript
const generateRegistrationChallenge = async (email, fullName) => {
  try {
    const response = await axios.post('/auth/superuser/register-challenge', {
      email,
      fullName
    });
    return response.data;
  } catch (error) {
    handleSuperuserError(error);
    throw error;
  }
};
```

#### Registration
```javascript
const register = async (registrationData) => {
  try {
    const response = await axios.post('/auth/superuser/register', registrationData);
    return response.data;
  } catch (error) {
    handleSuperuserError(error);
    throw error;
  }
};
```

#### Login Challenge
```javascript
const generateLoginChallenge = async () => {
  try {
    const response = await axios.post('/auth/superuser/login-challenge');
    return response.data;
  } catch (error) {
    handleSuperuserError(error);
    throw error;
  }
};
```

#### Login
```javascript
const login = async (authenticationData) => {
  try {
    const response = await axios.post('/auth/superuser/login', authenticationData);
    return response.data;
  } catch (error) {
    handleSuperuserError(error);
    throw error;
  }
};
```

### 3. Update Form Validation

#### React Example with Hooks
```javascript
import { useState } from 'react';

const SuperuserRegistrationForm = () => {
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({ email: '', fullName: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    try {
      await generateRegistrationChallenge(formData.email, formData.fullName);
      // Handle success
    } catch (error) {
      if (error.response?.data?.error?.code === 'VALIDATION_ERROR') {
        const errorData = error.response.data.error;
        
        if (errorData.details?.validationDetails?.missingFields) {
          const newErrors = {};
          errorData.details.validationDetails.missingFields.forEach(field => {
            newErrors[field] = `${field} is required`;
          });
          setErrors(newErrors);
        } else if (errorData.details?.field) {
          setErrors({
            [errorData.details.field]: errorData.message
          });
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          placeholder="Email"
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      
      <div>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          placeholder="Full Name"
        />
        {errors.fullName && <span className="error">{errors.fullName}</span>}
      </div>
      
      <button type="submit">Register</button>
    </form>
  );
};
```

### 4. Update User Feedback Messages

#### Create User-Friendly Messages
```javascript
const getErrorMessage = (errorData) => {
  const messages = {
    // Validation errors
    'VALIDATION_ERROR': {
      'email': 'Please enter a valid email address',
      'fullName': 'Please enter your full name',
      'missing_fields': 'Please fill in all required fields'
    },
    
    // Authentication errors
    'AUTHENTICATION_FAILED': {
      'challenge_expired': 'Your session has expired. Please start over.',
      'invalid_credentials': 'Authentication failed. Please try again.',
      'default': 'Authentication failed. Please check your credentials.'
    },
    
    // Conflict errors
    'CONFLICT_ERROR': {
      'DUPLICATE_EMAIL': 'This email is already registered. Please sign in instead.',
      'RESOURCE_TAKEN': 'This passkey is already in use. Please use a different device.',
      'default': 'This resource is already in use.'
    },
    
    // Not found errors
    'NOT_FOUND': {
      'default': 'The requested resource was not found.'
    }
  };

  const errorCode = errorData.code;
  const errorType = errorData.details?.conflictType || 
                   errorData.details?.field || 
                   'default';

  return messages[errorCode]?.[errorType] || 
         messages[errorCode]?.['default'] || 
         errorData.message || 
         'An unexpected error occurred';
};
```

## Testing Your Migration

### 1. Test Error Scenarios

Create test cases for each error type:

```javascript
// Test missing fields
const testMissingFields = async () => {
  try {
    await axios.post('/auth/superuser/register-challenge', {});
  } catch (error) {
    console.log('Missing fields error:', error.response.data);
  }
};

// Test duplicate email
const testDuplicateEmail = async () => {
  try {
    await axios.post('/auth/superuser/register-challenge', {
      email: 'existing@example.com',
      fullName: 'Test User'
    });
  } catch (error) {
    console.log('Duplicate email error:', error.response.data);
  }
};

// Test expired challenge
const testExpiredChallenge = async () => {
  // Wait for challenge to expire (5 minutes)
  try {
    await axios.post('/auth/superuser/register', {
      id: 'test',
      rawId: 'test',
      response: {},
      userInfo: {}
    });
  } catch (error) {
    console.log('Expired challenge error:', error.response.data);
  }
};
```

### 2. Verify Error Handling

Ensure your error handlers work correctly:

```javascript
const testErrorHandling = () => {
  const mockErrors = [
    {
      response: {
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Required fields are missing',
            details: {
              validationDetails: {
                missingFields: ['email']
              }
            }
          }
        }
      }
    }
  ];

  mockErrors.forEach(error => {
    handleSuperuserError(error);
  });
};
```

## Best Practices

1. **Always check `success` field**: Check if `response.data.success === false` before accessing error data
2. **Use error codes**: Use `error.code` for programmatic handling, not error messages
3. **Provide context**: Use `error.details` to provide specific feedback to users
4. **Graceful degradation**: Always have fallback error messages
5. **Log errors**: Log full error objects for debugging while showing user-friendly messages
6. **Handle network errors**: Don't forget to handle network/connection errors separately

## Common Pitfalls

1. **Don't rely on HTTP status codes alone**: Use the error code in the response body
2. **Don't hardcode error messages**: Use the provided error messages or create mappings
3. **Don't ignore error details**: The details object contains valuable context
4. **Don't forget to handle success responses**: Check the `success` field for all responses

## Support

If you encounter issues during migration:

1. Check the browser console for detailed error logs
2. Verify the API endpoint is returning the new format
3. Test with different error scenarios
4. Ensure your error handling covers all error codes

The standardized error format provides better user experience and easier debugging. Take advantage of the structured error details to provide specific, helpful feedback to your users.