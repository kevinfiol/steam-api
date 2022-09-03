import { postgres } from './deps.ts';

export const Postgres = (conn: string, config = {}) => {
    const sql = postgres(conn, config);

    return {
        async getApps(steam_appids: number | number[]) {
            if (!Array.isArray(steam_appids))
                steam_appids = [steam_appids];

            return await sql`
                select *
                from steam_app
                where steam_appid in ${ sql(steam_appids) }
            `;
        },

        async insertApp(app) {
            app = { ...app, updated_at: sql`now()` };

            return await sql`
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
                on conflict do nothing

                returning *
            `;
        },

        async getCategories() {
            return await sql`
                select category_id, description from steam_category
            `;
        },

        async insertCategories(categories: Array<{ category_id: string, description: string }>) {
            return await sql`
                insert into steam_category ${
                    sql(categories,
                        'category_id',
                        'description'
                    )
                }
                on conflict do nothing

                returning *
            `;
        }
    };
};