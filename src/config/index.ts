import dotenv from 'dotenv';

dotenv.config();

export const config = {
  node_env: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT || '3001', 10),
  log_level: process.env.LOG_LEVEL || 'info',

  browser: {
    pool_size: parseInt(process.env.BROWSER_POOL_SIZE || '3', 10),
    timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
    page_load_timeout: parseInt(process.env.PAGE_LOAD_TIMEOUT || '15000', 10),
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  },

  rate_limit: {
    window_ms: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max_requests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  api: {
    key: process.env.API_KEY || 'dev-key',
    enable_metrics: process.env.ENABLE_METRICS === 'true',
  },

  proxy: {
    use_proxy: process.env.USE_PROXY === 'true',
    proxy_url: process.env.PROXY_URL || null,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
