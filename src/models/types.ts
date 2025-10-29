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

export interface TeleUser {
  id?: number;
  chat_id: number;
  first_name: string;
  last_name: string;
  username: string;
  is_kyc?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateTeleUserRequest {
  chat_id: number;
  first_name: string;
  last_name: string;
  username: string;
}
