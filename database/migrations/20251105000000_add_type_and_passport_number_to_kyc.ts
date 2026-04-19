import type { Knex } from 'knex';

/**
 * Add type and passport_number fields to kyc table
 * This migration adds support for both CCCD and Passport document types
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('kyc', (table) => {
    // Add document type field (PASSPORT or IDC for Identity Card/CCCD)
    // Default to 'IDC' for existing records
    table
      .enum('type', ['PASSPORT', 'IDC'])
      .notNullable()
      .defaultTo('IDC')
      .comment('Document type: PASSPORT or IDC (Identity Card/CCCD)');

    // Add passport number field (nullable, only used when type is PASSPORT)
    table.string('passport_number', 255).nullable().comment('Passport number (only for PASSPORT type)');
  });
}

/**
 * Remove type and passport_number fields from kyc table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('kyc', (table) => {
    table.dropColumn('type');
    table.dropColumn('passport_number');
  });
}

