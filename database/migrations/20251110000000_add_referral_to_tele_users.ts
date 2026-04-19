import type { Knex } from 'knex';

/**
 * Add referral and referral_count columns to tele_users table
 * This migration adds support for referral tracking system
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('tele_users', (table) => {
    // Add referral field to store the username of the user who referred this account
    // Nullable because existing users won't have a referrer
    table
      .string('referral', 255)
      .nullable()
      .comment('Username of the user who referred this account');

    // Add referral_count field to track the total number of users referred by this account
    // Default to 0 for existing and new records
    table
      .integer('referral_count')
      .notNullable()
      .defaultTo(0)
      .comment('Total number of users referred by this account');
  });
}

/**
 * Drop referral and referral_count columns from tele_users table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('tele_users', (table) => {
    table.dropColumn('referral');
    table.dropColumn('referral_count');
  });
}
