import 'dotenv/config';
import { z } from 'zod';

const parsed = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    JWT_SECRET: z.string().min(16),
  })
  .safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  frontendUrl: parsed.data.FRONTEND_URL,
  jwtSecret: parsed.data.JWT_SECRET,
};
