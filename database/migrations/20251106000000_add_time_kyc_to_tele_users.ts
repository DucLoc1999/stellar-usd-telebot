import type { Knex } from 'knex';

/**
 * Add time_kyc column to tele_users table
 * This column tracks the number of KYC attempts (both successful and failed)
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('tele_users', (table) => {
    // Add time_kyc field to track KYC attempts
    // Default to 0 for existing and new records
    table
      .integer('time_kyc')
      .notNullable()
      .defaultTo(0)
      .comment('Number of KYC attempts (both successful and failed)');
  });
}

/**
 * Drop time_kyc column from tele_users table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('tele_users', (table) => {
    table.dropColumn('time_kyc');
  });
}
