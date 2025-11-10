import type { Knex } from 'knex';

/**
 * Change referral column from string (username) to bigInteger (chat_id)
 * This migration updates the referral tracking to use chat_id instead of username
 * for more reliable tracking since usernames can change but chat_id is permanent
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .alterTable('tele_users', (table) => {
      // Drop the existing referral column (string type)
      table.dropColumn('referral');
    })
    .then(() => {
      // Add the new referral column with bigInteger type
      return knex.schema.alterTable('tele_users', (table) => {
        table
          .bigInteger('referral')
          .nullable()
          .comment('Chat ID of the user who referred this account');
      });
    });
}

/**
 * Rollback: Change referral column back from bigInteger to string
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema
    .alterTable('tele_users', (table) => {
      // Drop the bigInteger referral column
      table.dropColumn('referral');
    })
    .then(() => {
      // Add back the string referral column
      return knex.schema.alterTable('tele_users', (table) => {
        table
          .string('referral', 255)
          .nullable()
          .comment('Username of the user who referred this account');
      });
    });
}
