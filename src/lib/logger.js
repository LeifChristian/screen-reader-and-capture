import winston from 'winston';
import path from 'path';

export function createLogger(logPath) {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ];

  if (logPath) {
    transports.push(
      new winston.transports.File({
        filename: logPath,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
          })
        )
      })
    );
  }

  return winston.createLogger({
    level: 'info',
    transports
  });
}
