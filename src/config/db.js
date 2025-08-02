const Database = require('../core/Database');

// Create and export a singleton instance
const database = new Database();
module.exports = database; 