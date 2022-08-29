import { sql } from './config.js';

try {
    await sql`
        create table if not exists steam_category (
            id serial primary key,
            category_id int unique not null,
            description text not null
        );
    `;
} catch (e) {
    console.log('Table not created.');
    console.error(e);
}

sql.end();