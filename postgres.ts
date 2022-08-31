import { postgres } from './deps.ts';

export const Postgres = (config = {}) => {
    const sql = postgres(config);

    return {
        async insertApp(app) {
            app = { ...app, updated_at: sql`now()` };

            const res = await sql`
                insert into steam_app ${
                    sql(app,
                        'steam_appid',
                        'name',
                        'header_image',
                        'is_free',
                        'platforms',
                        'categories',
                        'updated_at'
                    )
                }
            `;

            return res;
        }
    };
};