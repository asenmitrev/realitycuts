/**
 * PM2 Ecosystem Configuration
 * 
 * This EC2 instance is SHARED between UAT and PROD environments.
 * - UAT runs on port 3010
 * - PROD runs on port 3011
 * 
 * Each environment has its own process and uses its own .env file.
 */
module.exports = {
  apps: [
    {
      name: 'videoai-server-uat',
      script: './dist/index.js',
      cwd: '/home/ec2-user/app/uat',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'uat',
        PORT: 3010,
        IS_PROD: 'true'
      },
      // Note: .env.uat is loaded by the app via configureDotenv()
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ec2-user/app/logs/uat-error.log',
      out_file: '/home/ec2-user/app/logs/uat-output.log',
      combine_logs: true,
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
      min_uptime: '10s'
    },
    {
      name: 'videoai-server-prod',
      script: './dist/index.js',
      cwd: '/home/ec2-user/app/prod',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'prod',
        PORT: 3011,
        IS_PROD: 'true'
      },
      // Note: .env.prod is loaded by the app via configureDotenv()
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ec2-user/app/logs/prod-error.log',
      out_file: '/home/ec2-user/app/logs/prod-output.log',
      combine_logs: true,
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
      min_uptime: '10s'
    }
  ]
};
