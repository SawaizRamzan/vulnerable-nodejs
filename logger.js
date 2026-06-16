const winston = require('winston');
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'security.log' })
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});
logger.info('Application started');
module.exports = logger;