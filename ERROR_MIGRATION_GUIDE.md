# Error Response Migration Guide

## For Backend Developers

### How to Use Standardized Errors

#### 1. Import Error Classes
```javascript
const { 
    ValidationError, 
    AuthenticationError, 
    AuthorizationError, 
    NotFoundError,
    ConflictError,
    BusinessLogicError 
} = require('../core/errors');
```

#### 2. Replace Direct Responses

**❌ Old Way (Don't do this):**
```javascript
if (!email) {
    return res.status(400).json({
        error: 'Email is required'
    });
}

if (!user) {
    return res.status(404).json({
        error: 'User not found'
    });
}
```

**✅ New Way (Do this):**
```javascript
if (!email) {
    throw ValidationError.missingFields(['email']);
}

if (!user) {
    throw NotFoundError.user(userId);
}
```

#### 3. Always Use `next(error)` in Controllers

**❌ Old Way:**
```javascript
async someMethod(req, res) {
    try {
        // ... logic
    } catch (error) {
        res.status(500).json({
            error: 'Something went wrong: ' + error.message
        });
    }
}
```

**✅ New Way:**
```javascript
async someMethod(req, res, next) {
    try {
        // ... logic
    } catch (error) {
        this.logger.error('Method error:', error);
        next(error); // Let ErrorHandler middleware handle it
    }
}
```

#### 4. Common Error Patterns

```javascript
// Missing fields
if (!field1 || !field2) {
    throw ValidationError.missingFields(['field1', 'field2']);
}

// Invalid format
if (!emailRegex.test(email)) {
    throw ValidationError.invalidFormat('email', 'valid email address');
}

// Authentication required
if (!req.session.authenticated) {
    throw AuthenticationError.sessionRequired();
}

// Insufficient permissions
if (user.role !== 'admin') {
    throw AuthorizationError.insufficientPermissions('access admin panel');
}

// Resource not found
if (!product) {
    throw NotFoundError.product(productId);
}

// Duplicate resource
if (existingUser) {
    throw ConflictError.duplicateEmail(email);
}

// Business logic violation
if (age < 18) {
    throw BusinessLogicError.ageRestriction(18, age);
}
```

## For Frontend Developers

### How to Handle Standardized Errors

#### 1. Import Types (TypeScript)
```typescript
import { 
    ApiErrorResponse, 
    ApiSuccessResponse, 
    isApiError,
    isValidationError,
    isAuthenticationError 
} from './types/api-errors';
```

#### 2. Basic Error Handling

```typescript
try {
    const response = await api.post('/users', userData);
    // Handle success
    console.log('User created:', response.data);
} catch (error) {
    if (isApiError(error.response?.data)) {
        const apiError = error.response.data;
        
        // Now you have structured error data
        console.log('Error code:', apiError.error.code);
        console.log('Error message:', apiError.error.message);
        console.log('Error details:', apiError.error.details);
    }
}
```

#### 3. Specific Error Type Handling

```typescript
async function handleLogin(email: string, password: string) {
    try {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    } catch (error) {
        if (isApiError(error.response?.data)) {
            const apiError = error.response.data;
            
            if (isAuthenticationError(apiError)) {
                // Handle authentication errors
                if (apiError.error.details?.remainingAttempts) {
                    showError(`Login failed. ${apiError.error.details.remainingAttempts} attempts remaining.`);
                } else if (apiError.error.details?.blocked) {
                    showError(`Account blocked. Try again in ${apiError.error.details.secondsRemaining} seconds.`);
                } else {
                    showError('Invalid email or password.');
                }
            } else if (isValidationError(apiError)) {
                // Handle validation errors
                const missingFields = apiError.error.details?.validationDetails?.missingFields;
                if (missingFields) {
                    showError(`Please fill in: ${missingFields.join(', ')}`);
                }
            } else {
                // Handle other errors
                showError(apiError.error.message);
            }
        } else {
            // Handle network errors
            showError('Network error. Please try again.');
        }
    }
}
```

#### 4. Form Validation with Error Details

```typescript
async function submitForm(formData: any) {
    try {
        const response = await api.post('/products', formData);
        showSuccess('Product created successfully!');
        return response.data;
    } catch (error) {
        if (isApiError(error.response?.data)) {
            const apiError = error.response.data;
            
            switch (apiError.error.code) {
                case 'VALIDATION_ERROR':
                    const details = apiError.error.details?.validationDetails;
                    if (details?.missingFields) {
                        highlightFields(details.missingFields, 'error');
                        showError(`Missing required fields: ${details.missingFields.join(', ')}`);
                    }
                    if (details?.expectedFormat) {
                        showError(`Invalid format for ${apiError.error.details?.field}: ${details.expectedFormat}`);
                    }
                    break;
                    
                case 'CONFLICT_ERROR':
                    if (apiError.error.details?.conflictType === 'DUPLICATE_EMAIL') {
                        highlightField('email', 'error');
                        showError('This email is already registered.');
                    }
                    break;
                    
                case 'AUTHORIZATION_FAILED':
                    showError('You do not have permission to perform this action.');
                    redirectToLogin();
                    break;
                    
                default:
                    showError(apiError.error.message);
            }
        }
    }
}
```

#### 5. Global Error Handler (React Example)

```typescript
// Create a global error handler
export function useApiErrorHandler() {
    const showNotification = useNotification();
    const navigate = useNavigate();
    
    return useCallback((error: any) => {
        if (isApiError(error.response?.data)) {
            const apiError = error.response.data;
            
            switch (apiError.error.code) {
                case 'AUTHENTICATION_FAILED':
                    showNotification('Please log in to continue', 'error');
                    navigate('/login');
                    break;
                    
                case 'AUTHORIZATION_FAILED':
                    showNotification('Access denied', 'error');
                    navigate('/dashboard');
                    break;
                    
                case 'VALIDATION_ERROR':
                    showNotification(apiError.error.message, 'warning');
                    break;
                    
                case 'NOT_FOUND':
                    showNotification('Resource not found', 'error');
                    navigate('/404');
                    break;
                    
                case 'RATE_LIMITED':
                    const retryAfter = apiError.error.details?.retryAfter;
                    showNotification(`Too many requests. Try again in ${retryAfter} seconds.`, 'warning');
                    break;
                    
                default:
                    showNotification(apiError.error.message || 'An error occurred', 'error');
            }
        } else {
            showNotification('Network error. Please check your connection.', 'error');
        }
    }, [showNotification, navigate]);
}
```

## Migration Checklist

### Backend
- [ ] All controllers use `next(error)` instead of direct responses
- [ ] All validation errors use `ValidationError` class
- [ ] All authentication errors use `AuthenticationError` class
- [ ] All authorization errors use `AuthorizationError` class
- [ ] All not found errors use `NotFoundError` class
- [ ] Error handling is consistent across all endpoints

### Frontend
- [ ] Import TypeScript definitions
- [ ] Update API client to handle new error format
- [ ] Implement error type checking with type guards
- [ ] Update form validation to use error details
- [ ] Create user-friendly error messages for each error code
- [ ] Test error handling for all major user flows

## Testing Your Implementation

### Backend Testing
```javascript
// Test that errors return correct format
const response = await request(app)
    .post('/api/users')
    .send({}) // Missing required fields
    .expect(400);

expect(response.body).toMatchObject({
    success: false,
    error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: expect.any(Object),
        timestamp: expect.any(String)
    }
});
```

### Frontend Testing
```typescript
// Test error handling
it('should handle validation errors correctly', async () => {
    const mockError = {
        response: {
            data: {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Required fields are missing',
                    details: {
                        validationDetails: {
                            missingFields: ['email', 'password']
                        }
                    },
                    timestamp: '2025-08-05T09:34:01.990Z'
                }
            }
        }
    };
    
    // Test your error handling logic
    const result = handleApiError(mockError);
    expect(result.missingFields).toEqual(['email', 'password']);
});
```

## Common Mistakes to Avoid

1. **Don't mix old and new error formats**
2. **Don't forget to add `next` parameter to controller methods**
3. **Don't catch and re-throw errors unnecessarily**
4. **Don't ignore error details in frontend**
5. **Don't hardcode error messages - use the structured data**

## Need Help?

- Check `STANDARDIZED_ERROR_RESPONSE_IMPLEMENTATION.md` for complete documentation
- Look at existing controllers for examples
- Use TypeScript definitions for type safety
- Test your changes thoroughly before deploying