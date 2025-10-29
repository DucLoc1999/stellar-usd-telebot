# Fastify TypeScript MySQL Project

A production-ready REST API built with Fastify, TypeScript, and MySQL. This project includes comprehensive API documentation with Swagger, proper error handling, and follows best practices for Node.js application development.

## 🚀 Technology Stack

- **Framework**: [Fastify](https://www.fastify.io/) v4 - Fast and low overhead web framework
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Strict type checking enabled
- **Database**: [MySQL](https://www.mysql.com/) with connection pooling via `mysql2`
- **API Documentation**: Swagger/OpenAPI with `@fastify/swagger` and `@fastify/swagger-ui`
- **Code Quality**: ESLint + Prettier
- **Development**: Hot-reload with `tsx`

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: >= 18.0.0 ([Download](https://nodejs.org/))
- **MySQL**: >= 8.0 ([Download](https://dev.mysql.com/downloads/mysql/))
- **npm**: >= 9.0.0 (comes with Node.js)

## 📁 Project Structure

```
.
├── src/
│   ├── config/              # Configuration files
│   │   ├── app.ts          # Application configuration
│   │   └── database.ts     # MySQL connection pool setup
│   ├── routes/              # Route definitions
│   │   └── helloRoutes.ts  # Hello world routes
│   ├── controllers/         # Request handlers
│   │   └── helloController.ts
│   ├── services/            # Business logic layer
│   │   └── helloService.ts
│   ├── models/              # Data models and TypeScript types
│   │   └── types.ts
│   ├── middlewares/         # Custom middleware
│   │   └── errorHandler.ts # Global error handler
│   ├── utils/               # Utility functions
│   │   └── logger.ts       # Simple logger utility
│   ├── app.ts              # Fastify app initialization
│   └── server.ts           # Server entry point
├── .env.example            # Environment variables template
├── .eslintrc.json          # ESLint configuration
├── .prettierrc.json        # Prettier configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Project dependencies and scripts
```

## 🛠️ Installation & Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd fastify-typescript-mysql
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Application Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=fastify_db
```

### 4. Set up MySQL Database

Create a new database for the project:

```sql
CREATE DATABASE fastify_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Grant privileges to your database user:

```sql
GRANT ALL PRIVILEGES ON fastify_db.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

## 🏃 Running the Application

### Development Mode (with hot-reload)

```bash
npm run dev
```

The server will start on `http://localhost:3000` with automatic restart on file changes.

### Production Mode

1. Build the TypeScript code:

```bash
npm run build
```

2. Start the production server:

```bash
npm start
```

## 📚 API Documentation

Once the server is running, you can access the interactive API documentation:

- **Swagger UI**: [http://localhost:3000/documentation](http://localhost:3000/documentation)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **Hello World API**: [http://localhost:3000/api/hello](http://localhost:3000/api/hello)

### Example API Response

**GET** `/api/hello`

```json
{
  "success": true,
  "data": {
    "message": "Hello World"
  }
}
```

## 🧪 Code Quality

### Run ESLint

```bash
npm run lint
```

### Fix ESLint issues automatically

```bash
npm run lint:fix
```

### Format code with Prettier

```bash
npm run format
```

### Check formatting

```bash
npm run format:check
```

## 📝 Available NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint to check code quality |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check if code is formatted correctly |

## 🏗️ Architecture

This project follows a layered architecture pattern:

1. **Routes Layer** (`src/routes/`): Defines API endpoints and request validation schemas
2. **Controllers Layer** (`src/controllers/`): Handles HTTP requests and responses
3. **Services Layer** (`src/services/`): Contains business logic and data processing
4. **Models Layer** (`src/models/`): Defines TypeScript interfaces and types
5. **Middlewares Layer** (`src/middlewares/`): Custom middleware for error handling, authentication, etc.

### Request Flow

```
Client Request
    ↓
Route Handler (with Swagger schema)
    ↓
Controller (request/response handling)
    ↓
Service (business logic)
    ↓
Database (MySQL via connection pool)
    ↓
Response back through the layers
```

## 🔒 Database Connection Pool

The MySQL connection pool is configured with the following settings:

- **Connection Limit**: 10 connections (configurable)
- **Wait for Connections**: true
- **Queue Limit**: 0 (unlimited)

These settings ensure optimal performance and resource management.

## 🚨 Error Handling

The application includes comprehensive error handling:

- Global error handler middleware
- Validation error handling
- Database error handling
- Custom error responses with appropriate HTTP status codes
- Stack traces in development mode only

## 🌟 Features

- ✅ TypeScript with strict type checking
- ✅ Fastify web framework (high performance)
- ✅ MySQL database integration with connection pooling
- ✅ Swagger/OpenAPI documentation
- ✅ Environment-based configuration
- ✅ Comprehensive error handling
- ✅ ESLint + Prettier for code quality
- ✅ Hot-reload in development
- ✅ Graceful shutdown handling
- ✅ Health check endpoint
- ✅ CORS enabled
- ✅ Structured logging

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue in the repository.

