// Common types and interfaces used across the application

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HelloWorldResponse {
  message: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  waitForConnections: boolean;
  queueLimit: number;
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
}
