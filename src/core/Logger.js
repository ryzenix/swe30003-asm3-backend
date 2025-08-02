class Logger {
    constructor() {
        this.timestamp = () => new Date().toISOString();
    }

    log(level, message, data = null) {
        const timestamp = this.timestamp();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    error(message, error = null) {
        this.log('error', message, error);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    logRequest(req, res, next) {
        const timestamp = this.timestamp();
        console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
        if (req.body && Object.keys(req.body).length > 0) {
            console.log('Body:', JSON.stringify(req.body, null, 2));
        }
        next();
    }
}

module.exports = Logger; 