// TypeScript definitions for standardized error responses
// Use these types in your frontend for better type safety and error handling

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export type ErrorCode =
  // 400 - Validation Errors
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_ENTRY'
  | 'REFERENCE_ERROR'
  | 'REQUIRED_FIELD_MISSING'
  | 'INVALID_INPUT_FORMAT'
  
  // 401 - Authentication Errors
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_TOKEN'
  
  // 403 - Authorization Errors
  | 'AUTHORIZATION_FAILED'
  
  // 404 - Not Found Errors
  | 'NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  
  // 409 - Conflict Errors
  | 'CONFLICT_ERROR'
  
  // 422 - Business Logic Errors
  | 'BUSINESS_LOGIC_ERROR'
  
  // 429 - Rate Limiting
  | 'RATE_LIMITED'
  
  // 500 - Server Errors
  | 'INTERNAL_SERVER_ERROR'
  | 'DATABASE_ERROR'
  
  // 502 - External Service Errors
  | 'EXTERNAL_SERVICE_ERROR'
  
  // Special Cases
  | 'FILE_TOO_LARGE'
  | 'INVALID_JSON';

export interface ErrorDetails {
  // Validation Error Details
  field?: string;
  validationDetails?: {
    missingFields?: string[];
    expectedFormat?: string;
    providedValue?: any;
    validOptions?: string[];
    min?: number;
    max?: number;
    currentLength?: number;
    requirements?: string[];
  };
  
  // Not Found Error Details
  resource?: string;
  identifier?: string;
  
  // Conflict Error Details
  conflictType?: 'DUPLICATE_EMAIL' | 'DUPLICATE_SKU' | 'RESOURCE_TAKEN';
  conflictDetails?: {
    email?: string;
    sku?: string;
    resourceType?: string;
    value?: string;
  };
  
  // Authentication Error Details
  remainingAttempts?: number;
  blocked?: boolean;
  secondsRemaining?: number;
  retryAfter?: number;
  
  // Authorization Error Details
  requiredRole?: string;
  userRole?: string;
  
  // Business Logic Error Details
  businessRule?: 'PASSWORD_POLICY' | 'AGE_RESTRICTION' | 'FUTURE_DATE_NOT_ALLOWED' | 'INVALID_OPERATION';
  ruleDetails?: {
    requirements?: string[];
    currentLength?: number;
    minAge?: number;
    providedAge?: number;
    field?: string;
    operation?: string;
    reason?: string;
  };
  
  // External Service Error Details
  service?: 'AWS_S3' | 'DATABASE' | 'AUTH_SERVICE';
  serviceDetails?: {
    operation?: string;
    originalError?: string;
  };
  
  // Database Error Details
  constraint?: string;
  column?: string;
}

// Type guards for error checking
export function isApiError(response: any): response is ApiErrorResponse {
  return response && response.success === false && response.error;
}

export function isValidationError(error: ApiErrorResponse): boolean {
  return ['VALIDATION_ERROR', 'DUPLICATE_ENTRY', 'REFERENCE_ERROR', 'REQUIRED_FIELD_MISSING', 'INVALID_INPUT_FORMAT'].includes(error.error.code);
}

export function isAuthenticationError(error: ApiErrorResponse): boolean {
  return ['AUTHENTICATION_FAILED', 'INVALID_TOKEN'].includes(error.error.code);
}

export function isAuthorizationError(error: ApiErrorResponse): boolean {
  return error.error.code === 'AUTHORIZATION_FAILED';
}

export function isNotFoundError(error: ApiErrorResponse): boolean {
  return ['NOT_FOUND', 'ROUTE_NOT_FOUND'].includes(error.error.code);
}

export function isConflictError(error: ApiErrorResponse): boolean {
  return error.error.code === 'CONFLICT_ERROR';
}

export function isBusinessLogicError(error: ApiErrorResponse): boolean {
  return error.error.code === 'BUSINESS_LOGIC_ERROR';
}

export function isRateLimitError(error: ApiErrorResponse): boolean {
  return error.error.code === 'RATE_LIMITED';
}

export function isServerError(error: ApiErrorResponse): boolean {
  return ['INTERNAL_SERVER_ERROR', 'DATABASE_ERROR', 'EXTERNAL_SERVICE_ERROR'].includes(error.error.code);
}

// Error handler class for frontend
export class ApiErrorHandler {
  static handle(error: ApiErrorResponse): void {
    const { code, message, details } = error.error;
    
    switch (code) {
      case 'VALIDATION_ERROR':
        this.handleValidationError(message, details);
        break;
        
      case 'AUTHENTICATION_FAILED':
        this.handleAuthenticationError(message, details);
        break;
        
      case 'AUTHORIZATION_FAILED':
        this.handleAuthorizationError(message, details);
        break;
        
      case 'NOT_FOUND':
        this.handleNotFoundError(message, details);
        break;
        
      case 'CONFLICT_ERROR':
        this.handleConflictError(message, details);
        break;
        
      case 'BUSINESS_LOGIC_ERROR':
        this.handleBusinessLogicError(message, details);
        break;
        
      case 'RATE_LIMITED':
        this.handleRateLimitError(message, details);
        break;
        
      default:
        this.handleServerError(message, details);
        break;
    }
  }
  
  private static handleValidationError(message: string, details?: ErrorDetails): void {
    // Handle validation errors (show field errors, etc.)
    console.error('Validation Error:', message, details);
    
    if (details?.validationDetails?.missingFields) {
      // Show missing fields to user
      console.log('Missing fields:', details.validationDetails.missingFields);
    }
  }
  
  private static handleAuthenticationError(message: string, details?: ErrorDetails): void {
    // Handle auth errors (redirect to login, etc.)
    console.error('Authentication Error:', message, details);
    
    if (details?.remainingAttempts !== undefined) {
      console.log(`Remaining attempts: ${details.remainingAttempts}`);
    }
    
    if (details?.blocked && details?.secondsRemaining) {
      console.log(`Account blocked for ${details.secondsRemaining} seconds`);
    }
  }
  
  private static handleAuthorizationError(message: string, details?: ErrorDetails): void {
    // Handle authorization errors (show access denied, etc.)
    console.error('Authorization Error:', message, details);
    
    if (details?.requiredRole) {
      console.log(`Required role: ${details.requiredRole}`);
    }
  }
  
  private static handleNotFoundError(message: string, details?: ErrorDetails): void {
    // Handle not found errors (show 404 page, etc.)
    console.error('Not Found Error:', message, details);
    
    if (details?.resource && details?.identifier) {
      console.log(`${details.resource} with ID ${details.identifier} not found`);
    }
  }
  
  private static handleConflictError(message: string, details?: ErrorDetails): void {
    // Handle conflict errors (show appropriate message, etc.)
    console.error('Conflict Error:', message, details);
    
    if (details?.conflictType === 'DUPLICATE_EMAIL' && details?.conflictDetails?.email) {
      console.log(`Email ${details.conflictDetails.email} is already taken`);
    }
  }
  
  private static handleBusinessLogicError(message: string, details?: ErrorDetails): void {
    // Handle business logic errors (show validation message, etc.)
    console.error('Business Logic Error:', message, details);
    
    if (details?.businessRule === 'PASSWORD_POLICY' && details?.ruleDetails?.requirements) {
      console.log('Password requirements:', details.ruleDetails.requirements);
    }
  }
  
  private static handleRateLimitError(message: string, details?: ErrorDetails): void {
    // Handle rate limit errors (show retry message, etc.)
    console.error('Rate Limit Error:', message, details);
    
    if (details?.retryAfter) {
      console.log(`Please retry after ${details.retryAfter} seconds`);
    }
  }
  
  private static handleServerError(message: string, details?: ErrorDetails): void {
    // Handle server errors (show generic error message, etc.)
    console.error('Server Error:', message, details);
  }
}

// Usage examples:

/*
// Basic error checking
try {
  const response = await fetch('/api/users');
  const data = await response.json();
  
  if (isApiError(data)) {
    ApiErrorHandler.handle(data);
    return;
  }
  
  // Handle success case
  console.log('Success:', data);
} catch (error) {
  console.error('Network error:', error);
}

// Specific error type checking
try {
  const response = await api.login(email, password);
} catch (error) {
  if (isApiError(error.response?.data)) {
    const apiError = error.response.data;
    
    if (isAuthenticationError(apiError)) {
      // Handle authentication error
      if (apiError.error.details?.remainingAttempts) {
        showMessage(`Login failed. ${apiError.error.details.remainingAttempts} attempts remaining.`);
      }
    } else if (isValidationError(apiError)) {
      // Handle validation error
      const missingFields = apiError.error.details?.validationDetails?.missingFields;
      if (missingFields) {
        showFieldErrors(missingFields);
      }
    }
  }
}

// Form validation with detailed error handling
async function submitForm(formData: any) {
  try {
    const response = await api.post('/users', formData);
    return response.data;
  } catch (error) {
    if (isApiError(error.response?.data)) {
      const apiError = error.response.data;
      
      switch (apiError.error.code) {
        case 'VALIDATION_ERROR':
          const missingFields = apiError.error.details?.validationDetails?.missingFields;
          if (missingFields) {
            highlightMissingFields(missingFields);
          }
          break;
          
        case 'CONFLICT_ERROR':
          if (apiError.error.details?.conflictType === 'DUPLICATE_EMAIL') {
            showError('This email is already registered');
          }
          break;
          
        default:
          showError(apiError.error.message);
      }
    }
    throw error;
  }
}
*/