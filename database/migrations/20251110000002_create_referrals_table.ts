import type { Knex } from 'knex';

/**
 * Create referrals table to track referral relationships between users
 * This table maintains a dedicated record of all referral relationships,
 * making it easier to query referral data and generate referral statistics
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('referrals', (table) => {
    // Primary key
    table.increments('id').primary();

    // The chat_id of the new user who was referred
    table
      .bigInteger('chat_id')
      .notNullable()
      .unique()
      .comment('Chat ID of the user who was referred');

    // The chat_id of the user who made the referral (the referrer)
    table.bigInteger('referral').notNullable().comment('Chat ID of the user who made the referral');

    // Timestamps
    table.timestamps(true, true);

    // Indexes for performance
    table.index('chat_id', 'idx_referrals_chat_id');
    table.index('referral', 'idx_referrals_referral');
  });
}

/**
 * Rollback: Drop the referrals table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('referrals');
}
