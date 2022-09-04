import { postgres } from './deps.ts';

export const Postgres = (config = {}) => {
    const sql = postgres(config);

    return {
        getApps(steam_appids: number | number[]) {
            if (!Array.isArray(steam_appids))
                steam_appids = [steam_appids];

            return sql`
                select *
                from steam_app
                where steam_appid in ${ sql(steam_appids) }
            `;
        },

        async insertApp(app: Partial<App>) {
            // @ts-ignore: lib types
            const appRow: App = { ...app, updated_at: sql`now()` };

            return await sql`
                insert into steam_app ${
                    // @ts-ignore: lib types
                    sql(appRow,
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

        getCategories() {
            return sql`
                select category_id, description from steam_category
            `;
        },

        insertCategories(categories: Category[]) {
            return sql`
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