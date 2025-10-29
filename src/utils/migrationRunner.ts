import db from '../config/knex';
import logger from './logger';

/**
 * Run all pending database migrations
 * @throws Error if migration fails
 */
export async function runMigrations(): Promise<void> {
  try {
    logger.info('🔄 Checking for pending database migrations...');

    const [batchNo, migrations] = (await db.migrate.latest()) as [number, string[]];

    if (migrations.length === 0) {
      logger.info('✅ Database is up to date - no migrations to run');
    } else {
      logger.info(`✅ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        logger.info(`   - ${migration}`);
      });
      logger.info(`📦 Batch number: ${batchNo}`);
    }
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw new Error(
      `Database migration failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the current migration status
 */
export async function getMigrationStatus(): Promise<{
  currentVersion: string;
  pendingMigrations: string[];
}> {
  try {
    const [completed, pending] = (await db.migrate.list()) as [string[][], string[]];

    return {
      currentVersion: completed[0]?.[completed[0].length - 1] || 'none',
      pendingMigrations: pending || [],
    };
  } catch (error) {
    logger.error('Failed to get migration status:', error);
    throw error;
  }
}

export default runMigrations;
