import { z } from 'zod';

export const DEPLOYMENT_MODES = ['static', 'static-enumerated', 'server'] as const;
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];

export const DEFAULT_WEB_HOST = '0.0.0.0';
export const DEFAULT_WEB_PORT = 4173;
export const DEFAULT_DEPLOYMENT_MODE: DeploymentMode = 'server';

export const webHostSchema = z
  .string()
  .trim()
  .min(1, 'Host cannot be empty')
  .default(DEFAULT_WEB_HOST);

export const webPortSchema = z.coerce
  .number()
  .int('Port must be an integer')
  .min(1, 'Port must be between 1 and 65535')
  .max(65535, 'Port must be between 1 and 65535')
  .default(DEFAULT_WEB_PORT);

export const deploymentModeSchema = z
  .enum(DEPLOYMENT_MODES, {
    message: `Invalid deployment mode, expected one of: ${DEPLOYMENT_MODES.join(', ')}`,
  })
  .default(DEFAULT_DEPLOYMENT_MODE);

export type WebConfig = Readonly<{
  host: string;
  port: number;
  deploymentMode: DeploymentMode;
  distDir?: string;
}>;

export type AuthConfig =
  Readonly<{ mode: 'mock' }> | Readonly<{ mode: 'backend'; apiBaseUrl: string }>;

export type AppConfig = Readonly<{
  web: WebConfig;
  auth: AuthConfig;
  isProduction: boolean;
}>;
