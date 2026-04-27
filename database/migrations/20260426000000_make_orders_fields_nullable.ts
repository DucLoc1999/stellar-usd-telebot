import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.string('client_ip').nullable().alter();
    table.string('outcome').nullable().alter();
    table.string('original_rate').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.string('client_ip').notNullable().alter();
    table.string('outcome').notNullable().alter();
    table.string('original_rate').notNullable().alter();
  });
}
