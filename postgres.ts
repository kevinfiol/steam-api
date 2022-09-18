/// <reference types="./types.d.ts" />

import { postgres } from './deps.ts';

export const Postgres = (config = {}): Database => {
    const sql = postgres(config);

    return {
        getApps(steam_appids: number | number[]) {
            if (!Array.isArray(steam_appids))
                steam_appids = [steam_appids];

            return sql<App[]>`
                select *
                from steam_app
                where steam_appid in ${ sql(steam_appids) }
            `;
        },

        getCategories() {
            return sql<Category[]>`
                select category_id, description from steam_category
            `;
        },

        insertApp(app: Partial<App>) {
            const appRow = { ...app, updated_at: sql`now()` };

            return sql`
                insert into steam_app ${
                    // @ts-ignore: finicky postgres.js types
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
        },

        insertCommonApps(steamids: string, apps: App[]) {
            return sql`
                insert into steam_common (steamids, data, updated_at)
                values (
                    ${steamids},
                    ${JSON.stringify(apps)},
                    now()
                )
                on conflict (steamids)
                do update set (data, updated_at) = (excluded.data, excluded.updated_at)

                returning *
            `;
        },

        getCommonApps(steamids: string) {
            return sql`
                select data, EXTRACT(EPOCH FROM (now() - updated_at)) as age
                from steam_common
                where steamids = ${steamids}
            `;
        }
    };
};