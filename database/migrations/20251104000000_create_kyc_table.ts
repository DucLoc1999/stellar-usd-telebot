import type { Knex } from 'knex';

/**
 * Create kyc table
 * This table stores user KYC (Know Your Customer) information for identity verification
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('kyc', (table) => {
    // Primary key
    table.increments('id').primary();

    // Foreign key to tele_users table
    // Using bigInteger to match the chat_id type in tele_users table
    // Each user should only have one KYC record, so we add a unique constraint
    table.bigInteger('chat_id').notNullable().unique();
    table.foreign('chat_id').references('chat_id').inTable('tele_users').onDelete('CASCADE');

    table.string('phone', 255).notNullable().comment('phoneNumber');

    // Identification document information
    table.string('id_number', 255).notNullable().unique().comment('Identification document number');
    table.string('name', 255).notNullable().comment('User full legal name');
    table.date('dob').notNullable().comment('Date of birth');
    table.string('sex', 50).notNullable().comment('User gender');
    table.string('nationality', 100).notNullable().comment('User nationality');
    table.string('home', 255).notNullable().comment('User hometown/place of origin');
    table.text('address').notNullable().comment('Current residential address');
    table.date('doe').notNullable().comment('ID document expiration date');

    // Timestamps - automatically managed
    // First parameter (true): use timestamps
    // Second parameter (true): use camelCase (createdAt, updatedAt)
    table.timestamps(true, true);

    // Index on chat_id for query performance (already unique, but explicit for clarity)
    table.index('chat_id');
  });
}

/**
 * Drop kyc table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('kyc');
}
