import dotenv from 'dotenv';

export const configureDotenv = () => {
  const env = process.env.ENVIRONMENT || 'dev';
  dotenv.config({ path: `.env.${env}` });
};
