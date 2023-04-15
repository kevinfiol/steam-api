import { sql } from './config.js';

try {
  await sql`
    create table if not exists steam_common (
      id serial primary key,
      steamids text unique not null,
      data json,
      updated_at timestamp not null
    );
  `;
} catch (e) {
  console.log('Table not created.');
  console.error(e);
}

sql.end();