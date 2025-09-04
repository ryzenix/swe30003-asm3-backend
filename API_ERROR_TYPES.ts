// TypeScript interfaces for API error responses
// Use these types in your frontend for better type safety

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

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

// Error response by status code
export interface ValidationErrorResponse extends ApiErrorResponse {
  error: {
    code: 'VALIDATION_ERROR' | 'DUPLICATE_ENTRY' | 'REFERENCE_ERROR' | 'REQUIRED_FIELD_MISSING' | 'INVALID_INPUT_FORMAT';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface AuthenticationErrorResponse extends ApiErrorResponse {
  error: {
    code: 'AUTHENTICATION_FAILED' | 'INVALID_TOKEN';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface AuthorizationErrorResponse extends ApiErrorResponse {
  error: {
    code: 'AUTHORIZATION_FAILED';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface NotFoundErrorResponse extends ApiErrorResponse {
  error: {
    code: 'NOT_FOUND' | 'ROUTE_NOT_FOUND';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface ConflictErrorResponse extends ApiErrorResponse {
  error: {
    code: 'CONFLICT_ERROR';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface BusinessLogicErrorResponse extends ApiErrorResponse {
  error: {
    code: 'BUSINESS_LOGIC_ERROR';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface RateLimitErrorResponse extends ApiErrorResponse {
  error: {
    code: 'RATE_LIMITED';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface ServerErrorResponse extends ApiErrorResponse {
  error: {
    code: 'INTERNAL_SERVER_ERROR' | 'DATABASE_ERROR' | 'EXTERNAL_SERVICE_ERROR';
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

// Utility type guards
export function isValidationError(error: ApiErrorResponse): error is ValidationErrorResponse {
  return [400].includes(getStatusFromErrorCode(error.error.code));
}

export function isAuthenticationError(error: ApiErrorResponse): error is AuthenticationErrorResponse {
  return [401].includes(getStatusFromErrorCode(error.error.code));
}

export function isAuthorizationError(error: ApiErrorResponse): error is AuthorizationErrorResponse {
  return [403].includes(getStatusFromErrorCode(error.error.code));
}

export function isNotFoundError(error: ApiErrorResponse): error is NotFoundErrorResponse {
  return [404].includes(getStatusFromErrorCode(error.error.code));
}

export function isConflictError(error: ApiErrorResponse): error is ConflictErrorResponse {
  return [409].includes(getStatusFromErrorCode(error.error.code));
}

export function isBusinessLogicError(error: ApiErrorResponse): error is BusinessLogicErrorResponse {
  return [422].includes(getStatusFromErrorCode(error.error.code));
}

export function isRateLimitError(error: ApiErrorResponse): error is RateLimitErrorResponse {
  return [429].includes(getStatusFromErrorCode(error.error.code));
}

export function isServerError(error: ApiErrorResponse): error is ServerErrorResponse {
  return [500, 502].includes(getStatusFromErrorCode(error.error.code));
}

// Helper function to get HTTP status from error code
function getStatusFromErrorCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    // 400
    'VALIDATION_ERROR': 400,
    'DUPLICATE_ENTRY': 400,
    'REFERENCE_ERROR': 400,
    'REQUIRED_FIELD_MISSING': 400,
    'INVALID_INPUT_FORMAT': 400,
    'FILE_TOO_LARGE': 400,
    'INVALID_JSON': 400,
    
    // 401
    'AUTHENTICATION_FAILED': 401,
    'INVALID_TOKEN': 401,
    
    // 403
    'AUTHORIZATION_FAILED': 403,
    
    // 404
    'NOT_FOUND': 404,
    'ROUTE_NOT_FOUND': 404,
    
    // 409
    'CONFLICT_ERROR': 409,
    
    // 422
    'BUSINESS_LOGIC_ERROR': 422,
    
    // 429
    'RATE_LIMITED': 429,
    
    // 500
    'INTERNAL_SERVER_ERROR': 500,
    'DATABASE_ERROR': 500,
    
    // 502
    'EXTERNAL_SERVICE_ERROR': 502
  };
  
  return statusMap[code] || 500;
}

// Example usage in frontend error handling
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
  }
  
  private static handleAuthenticationError(message: string, details?: ErrorDetails): void {
    // Handle auth errors (redirect to login, etc.)
    console.error('Authentication Error:', message, details);
  }
  
  private static handleAuthorizationError(message: string, details?: ErrorDetails): void {
    // Handle authorization errors (show access denied, etc.)
    console.error('Authorization Error:', message, details);
  }
  
  private static handleNotFoundError(message: string, details?: ErrorDetails): void {
    // Handle not found errors (show 404 page, etc.)
    console.error('Not Found Error:', message, details);
  }
  
  private static handleConflictError(message: string, details?: ErrorDetails): void {
    // Handle conflict errors (show appropriate message, etc.)
    console.error('Conflict Error:', message, details);
  }
  
  private static handleBusinessLogicError(message: string, details?: ErrorDetails): void {
    // Handle business logic errors (show validation message, etc.)
    console.error('Business Logic Error:', message, details);
  }
  
  private static handleRateLimitError(message: string, details?: ErrorDetails): void {
    // Handle rate limit errors (show retry message, etc.)
    console.error('Rate Limit Error:', message, details);
  }
  
  private static handleServerError(message: string, details?: ErrorDetails): void {
    // Handle server errors (show generic error message, etc.)
    console.error('Server Error:', message, details);
  }
}