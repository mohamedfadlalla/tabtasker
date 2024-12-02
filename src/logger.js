// logger.js
const logger = {
  info: (message, ...args) => {
    console.log(`ℹ️ ${message}`, ...args);
  },
  success: (message, ...args) => {
    console.log(`✅ ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`❌ ${message}`, ...args);
  },
  warning: (message, ...args) => {
    console.warn(`⚠️ ${message}`, ...args);
  },
  // Add warn as alias to warning for compatibility
  warn: (message, ...args) => {
    console.warn(`⚠️ ${message}`, ...args);
  },
  group: (label) => {
    console.group(`📑 ${label}`);
  },
  groupEnd: () => {
    console.groupEnd();
  }
};

export default logger;