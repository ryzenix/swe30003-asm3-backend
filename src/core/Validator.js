class Validator {
    constructor() {
        this.errors = [];
    }

    clearErrors() {
        this.errors = [];
    }

    addError(field, message) {
        this.errors.push({ field, message });
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    getErrors() {
        return this.errors;
    }

    validateRequired(data, requiredFields) {
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            this.addError('required', `Required fields are missing: ${missingFields.join(', ')}`);
            return false;
        }

        return true;
    }

    validateNumber(field, value, min = null, max = null) {
        if (value === undefined || value === null) return true;
        
        if (typeof value !== 'number') {
            this.addError(field, `${field} must be a number`);
            return false;
        }

        if (min !== null && value < min) {
            this.addError(field, `${field} must be at least ${min}`);
            return false;
        }

        if (max !== null && value > max) {
            this.addError(field, `${field} must be at most ${max}`);
            return false;
        }

        return true;
    }

    validateString(field, value, minLength = null, maxLength = null) {
        if (value === undefined || value === null) return true;
        
        if (typeof value !== 'string') {
            this.addError(field, `${field} must be a string`);
            return false;
        }

        if (minLength !== null && value.length < minLength) {
            this.addError(field, `${field} must be at least ${minLength} characters long`);
            return false;
        }

        if (maxLength !== null && value.length > maxLength) {
            this.addError(field, `${field} must be at most ${maxLength} characters long`);
            return false;
        }

        return true;
    }

    validateEnum(field, value, validValues) {
        if (value === undefined || value === null) return true;
        
        if (!validValues.includes(value)) {
            this.addError(field, `${field} must be one of: ${validValues.join(', ')}`);
            return false;
        }

        return true;
    }

    validateDate(field, value, format = 'YYYY-MM-DD') {
        if (value === undefined || value === null) return true;
        
        if (format === 'YYYY-MM-DD') {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(value)) {
                this.addError(field, `${field} must be in YYYY-MM-DD format`);
                return false;
            }
        }

        return true;
    }

    validateEmail(field, value) {
        if (value === undefined || value === null) return true;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            this.addError(field, `${field} must be a valid email address`);
            return false;
        }

        return true;
    }

    validateArray(field, value, minLength = null, maxLength = null) {
        if (value === undefined || value === null) return true;
        
        if (!Array.isArray(value)) {
            this.addError(field, `${field} must be an array`);
            return false;
        }

        if (minLength !== null && value.length < minLength) {
            this.addError(field, `${field} must have at least ${minLength} items`);
            return false;
        }

        if (maxLength !== null && value.length > maxLength) {
            this.addError(field, `${field} must have at most ${maxLength} items`);
            return false;
        }

        return true;
    }
}

module.exports = Validator; 