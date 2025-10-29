import type { Knex } from 'knex';

/**
 * Create tele_users table
 * This table stores Telegram user information
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('tele_users', (table) => {
    // Primary key
    table.increments('id').primary();

    // Telegram chat ID - unique identifier for each user
    table.bigInteger('chat_id').notNullable().unique();

    // User profile information
    table.string('first_name', 255).nullable();
    table.string('last_name', 255).nullable();
    table.string('username', 255).nullable();

    // KYC status
    table.boolean('is_kyc').defaultTo(false).notNullable();

    // Timestamps - automatically managed
    table.timestamps(true, true);
  });
}

/**
 * Drop tele_users table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('tele_users');
}
