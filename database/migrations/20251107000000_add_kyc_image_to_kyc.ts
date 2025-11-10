import type { Knex } from 'knex';

/**
 * Add kyc_image column to kyc table
 * This column stores the S3 URL of the uploaded KYC image
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('kyc', (table) => {
    // Add kyc_image field to store S3 URL
    table.string('kyc_image', 500).nullable().comment('S3 URL of the uploaded KYC image');
  });
}

/**
 * Drop kyc_image column from kyc table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('kyc', (table) => {
    table.dropColumn('kyc_image');
  });
}

