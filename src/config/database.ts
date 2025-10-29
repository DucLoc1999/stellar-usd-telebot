import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import type { DatabaseConfig } from '../models/types';

// Load environment variables before using them
dotenv.config();

const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fastify_db',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
};

// Create connection pool
export const pool = mysql.createPool(databaseConfig);

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    console.warn('✅ Database connection established successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export default pool;
