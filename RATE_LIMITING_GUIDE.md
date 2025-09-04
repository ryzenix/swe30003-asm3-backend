# Rate Limiting System Guide

## Overview

This backend implements a comprehensive rate limiting system to protect against abuse, brute force attacks, and excessive resource consumption. The system uses different rate limiting strategies based on the type of operation and sensitivity level.

## Rate Limiting Components

### Core RateLimiter Service

Located at `src/core/RateLimiter.js`, this service provides different rate limiting configurations:

#### 1. Global Rate Limiter
- **Limit**: 500 requests per hour per IP
- **Purpose**: Overall application protection
- **Applied to**: All requests globally

#### 2. General API Rate Limiter  
- **Limit**: 100 requests per 15 minutes per IP
- **Purpose**: Standard API protection
- **Applied to**: Regular API endpoints like session management, logout

#### 3. Authentication Rate Limiter
- **Limit**: 5 requests per 15 minutes per IP
- **Purpose**: Prevent brute force attacks
- **Applied to**: Login, registration, password changes, email checks
- **Special feature**: Skips successful requests (only counts failed attempts)

#### 4. Read-Only Rate Limiter
- **Limit**: 200 requests per 15 minutes per IP
- **Purpose**: Lenient limits for data retrieval
- **Applied to**: GET endpoints like product lists, staff lists

#### 5. Destructive Operations Rate Limiter
- **Limit**: 20 requests per hour per IP
- **Purpose**: Protect against excessive modifications
- **Applied to**: Create, update, delete operations

#### 6. File Upload Rate Limiter
- **Limit**: 10 uploads per hour per IP
- **Purpose**: Prevent storage abuse and server overload
- **Applied to**: File upload endpoints

## Rate Limiting by Endpoint

### Product Routes (`/products`)
```
GET /products/list          → Read-Only Limiter (200/15min)
GET /products/:id           → Read-Only Limiter (200/15min)
POST /products/create       → Destructive Operations Limiter (20/hour)
PUT /products/update/:id    → Destructive Operations Limiter (20/hour)
DELETE /products/delete/:id → Destructive Operations Limiter (20/hour)
POST /products/:id/images/upload → File Upload Limiter (10/hour)
DELETE /products/:id/images/:index → Destructive Operations Limiter (20/hour)
PUT /products/:id/images/:index/main → Destructive Operations Limiter (20/hour)
```

### Authentication Routes (`/auth`)
```
GET /auth/session    → General API Limiter (100/15min)
POST /auth/logout    → General API Limiter (100/15min)
```

### User Authentication Routes (`/auth/user`)
```
POST /auth/user/check-email     → Auth Limiter (5/15min)
POST /auth/user/register        → Auth Limiter (5/15min)
POST /auth/user/login           → Auth Limiter (5/15min)
POST /auth/user/logout          → General API Limiter (100/15min)
POST /auth/user/change-password → Auth Limiter (5/15min)
```

### Superuser Routes (`/auth/superuser`)
```
POST /auth/superuser/check-email        → Auth Limiter (5/15min)
GET /auth/superuser/session             → General API Limiter (100/15min)
POST /auth/superuser/logout             → General API Limiter (100/15min)
POST /auth/superuser/register-challenge → Auth Limiter (5/15min)
POST /auth/superuser/register           → Auth Limiter (5/15min)
POST /auth/superuser/login-challenge    → Auth Limiter (5/15min)
POST /auth/superuser/login              → Auth Limiter (5/15min)
```

### Staff Management Routes (`/management/users`)
```
GET /management/users/list          → Read-Only Limiter (200/15min)
POST /management/users/create-staff → Destructive Operations Limiter (20/hour)
PUT /management/users/modify/:id    → Destructive Operations Limiter (20/hour)
DELETE /management/users/delete/:id → Destructive Operations Limiter (20/hour)
```

## Rate Limit Response Format

When a rate limit is exceeded, the API returns a `429 Too Many Requests` status with this format:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests from this IP, please try again later.",
  "retryAfter": "15 minutes"
}
```

The response also includes standard rate limiting headers:
- `RateLimit-Limit`: The rate limit ceiling for that given request
- `RateLimit-Remaining`: The remaining number of requests in the current window
- `RateLimit-Reset`: The time when the rate limit window resets

## Configuration

### Customizing Rate Limits

To modify rate limits, edit the values in `src/core/RateLimiter.js`:

```javascript
// Example: Increase auth rate limit to 10 attempts per 15 minutes
authLimiter() {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Changed from 5 to 10
        // ... rest of configuration
    });
}
```

### Creating Custom Rate Limiters

The RateLimiter class provides a factory method for custom configurations:

```javascript
// Example: Create a custom limiter for a specific endpoint
const customLimiter = this.rateLimiter.createCustomLimiter({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 50, // 50 requests per 30 minutes
    message: 'Custom rate limit exceeded',
    skipSuccessfulRequests: true
});

// Apply to a specific route
router.post('/special-endpoint', customLimiter, controller.method);
```

## Security Benefits

1. **Brute Force Protection**: Strict limits on authentication endpoints prevent password attacks
2. **Resource Protection**: File upload and destructive operation limits prevent server overload
3. **DoS Prevention**: Global rate limiting protects against denial of service attacks
4. **API Abuse Prevention**: General rate limiting prevents excessive API usage
5. **Data Enumeration Protection**: Auth rate limiting on email checks prevents user enumeration

## Best Practices

1. **Monitor Rate Limit Logs**: Check application logs for rate limit violations to identify potential attacks
2. **Adjust Limits Based on Usage**: Monitor legitimate usage patterns and adjust limits accordingly
3. **Consider User Authentication**: Future enhancement could implement different limits for authenticated vs. anonymous users
4. **Implement Whitelisting**: Consider implementing IP whitelisting for trusted sources if needed
5. **Use Redis for Scaling**: For production with multiple servers, consider using Redis as a shared rate limit store

## Troubleshooting

### Common Issues

1. **Legitimate Users Hitting Limits**: If legitimate users frequently hit rate limits, consider increasing the limits for specific endpoints
2. **False Positives**: If multiple users share an IP (corporate networks), you might need to implement user-based rate limiting
3. **Development Issues**: During development, you might want to disable or increase rate limits

### Disabling Rate Limiting (Development Only)

To temporarily disable rate limiting during development, you can comment out the rate limiter middleware in the route files:

```javascript
// Comment out rate limiter for development
// this.rateLimiter.authLimiter(),
this.authenticator.authenticateUser.bind(this.authenticator),
```

## Environment Considerations

- **Development**: Consider using higher limits or disabling rate limiting
- **Testing**: Rate limits might interfere with automated tests
- **Production**: Use the configured limits as a starting point and adjust based on monitoring

## Monitoring and Analytics

The rate limiting system logs violations through the Logger service. Monitor these logs to:
- Identify potential attacks
- Understand usage patterns
- Optimize rate limit configurations
- Detect false positives

Example log entry:
```
WARN: Rate limit exceeded for IP: 192.168.1.100 on /auth/user/login
```

## Future Enhancements

Consider implementing:
1. **User-based rate limiting**: Different limits for authenticated users
2. **Geolocation-based limiting**: Stricter limits for certain geographic regions
3. **Adaptive rate limiting**: Dynamic limits based on system load
4. **Redis integration**: Shared rate limiting across multiple server instances
5. **Rate limit exemption**: Whitelist functionality for trusted IPs or users