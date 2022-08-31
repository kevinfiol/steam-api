import { sql } from './config.js';

try {
    await sql`
        create table if not exists steam_app (
            id serial primary key,
            steam_appid bigint unique not null,
            name text not null,
            categories int[],
            header_image text,
            is_free boolean,
            platforms json,
            updated_at timestamp not null
        );
    `;
} catch (e) {
    console.log('Table not created.');
    console.error(e);
}

sql.end();