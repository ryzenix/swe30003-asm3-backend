const Logger = require('./Logger');
const S3Service = require('./S3Service');
const Database = require('./Database');

/**
 * ServiceManager - Singleton class to manage shared service instances
 * This prevents multiple initialization of services across the application
 */
class ServiceManager {
    constructor() {
        if (ServiceManager.instance) {
            return ServiceManager.instance;
        }

        // Initialize shared services once
        this._logger = null;
        this._s3Service = null;
        this._database = null;

        ServiceManager.instance = this;
    }

    /**
     * Get shared Logger instance
     * @returns {Logger}
     */
    getLogger() {
        if (!this._logger) {
            this._logger = new Logger();
        }
        return this._logger;
    }

    /**
     * Get shared S3Service instance
     * @returns {S3Service}
     */
    getS3Service() {
        if (!this._s3Service) {
            this._s3Service = new S3Service();
        }
        return this._s3Service;
    }

    /**
     * Get shared Database instance
     * @returns {Database}
     */
    getDatabase() {
        if (!this._database) {
            this._database = new Database();
        }
        return this._database;
    }

    /**
     * Reset all services (useful for testing)
     */
    reset() {
        this._logger = null;
        this._s3Service = null;
        this._database = null;
    }

    /**
     * Get singleton instance
     * @returns {ServiceManager}
     */
    static getInstance() {
        if (!ServiceManager.instance) {
            ServiceManager.instance = new ServiceManager();
        }
        return ServiceManager.instance;
    }
}

module.exports = ServiceManager;