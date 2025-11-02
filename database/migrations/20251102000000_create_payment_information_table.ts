import type { Knex } from 'knex';

/**
 * Create payment_information table
 * This table stores user payment information for both bank and crypto payments
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('payment_information', (table) => {
    // Primary key
    table.increments('id').primary();

    // Foreign key to tele_users table
    // Using bigInteger to match the chat_id type in tele_users table
    table.bigInteger('chat_id').notNullable();
    table.foreign('chat_id').references('chat_id').inTable('tele_users').onDelete('CASCADE');

    // Payment type - BANK or CRYPTO
    table.enum('type', ['BANK', 'CRYPTO']).notNullable();

    // Crypto payment fields (nullable, used when type = 'CRYPTO')
    table.string('wallet_address', 255).nullable();

    // Bank payment fields (nullable, used when type = 'BANK')
    table.integer('bank_id').nullable();
    table.string('full_name', 255).nullable();
    table.string('bank_account', 255).nullable();

    // Timestamps - automatically managed
    table.timestamps(true, true);

    // Index on chat_id for query performance
    table.index('chat_id');
  });
}

/**
 * Drop payment_information table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('payment_information');
}
