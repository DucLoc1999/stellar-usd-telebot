import type { Knex } from 'knex';

/**
 * Create orders table
 * This table stores order information for payment processing
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('orders', (table) => {
    // Primary key - UUID format, not auto-increment
    table.string('id', 36).primary().notNullable();

    // Foreign key to tele_users table
    // Note: Using bigInteger to match the chat_id type in tele_users table
    table.bigInteger('chat_id').notNullable();
    table.foreign('chat_id').references('chat_id').inTable('tele_users').onDelete('CASCADE');

    // User and order identification
    table.string('user_id').notNullable();
    table.integer('order_type').notNullable();
    table.string('external_id').nullable();
    table.string('code').notNullable();

    // Provider and callback information
    table.integer('provider').notNullable();
    table.string('callback').notNullable();

    // Payment details
    table.string('amount').notNullable();
    table.string('currency').notNullable();
    table.string('rate').notNullable();

    // Blockchain information
    table.string('token_address').notNullable();
    table.string('recipient').notNullable();
    table.integer('chain_id').notNullable();

    // Partner and state information
    table.string('partner_id').notNullable();
    table.integer('state').notNullable();
    table.integer('processing_state').notNullable();

    // JSON data fields (nullable)
    table.json('body').nullable();
    table.json('pay_data').nullable();
    table.json('payment_info').nullable();

    // Timestamps
    table.timestamp('expired_at').notNullable();
    table.timestamps(true, true); // created_at and updated_at

    // Additional fields
    table.string('client_ip').notNullable();
    table.string('outcome').notNullable();
    table.string('original_rate').notNullable();
    table.string('total_fee_vnd').notNullable();
  });
}

/**
 * Drop orders table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('orders');
}
