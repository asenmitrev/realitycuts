import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

export const configureDotenv = () => {
  const env = process.env.ENVIRONMENT || 'dev';
  const envFile = path.resolve(process.cwd(), `.env.${env}`);
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  } else {
    // Fall back to a plain .env when no per-environment file exists.
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  }
};
