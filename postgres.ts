import { postgres } from './deps.ts';

export const Postgres = (config = {}) => {
    const pool = new postgres.Pool(config, 2, true);

    const sql = async (query: string, args?: unknown[] | Record<string, unknown>) => {
        const client = await pool.connect();
        let rows: any[] = [];

        try {
            const results = await client.queryObject(query, args);
            rows = results.rows || [];
        } catch (e) {
            console.error(e);
        } finally {
            client.release();
        }

        return rows;
    };

    return {
        // async getApps(steam_appids: number | number[]) {
        //     if (!Array.isArray(steam_appids))
        //         steam_appids = [steam_appids];

        //     return await sql`
        //         select *
        //         from steam_app
        //         where steam_appid in ${ sql(steam_appids) }
        //     `;
        // },

        // async insertApp(app) {
        //     app = { ...app, updated_at: sql`now()` };

        //     return await sql`
        //         insert into steam_app ${
        //             sql(app,
        //                 'steam_appid',
        //                 'name',
        //                 'header_image',
        //                 'is_free',
        //                 'platforms',
        //                 'categories',
        //                 'updated_at'
        //             )
        //         }
        //         on conflict do nothing

        //         returning *
        //     `;
        // },

        getCategories() {
            return sql(`
                select category_id, description from steam_category
            `);
        },

        // async insertCategories(categories: Array<{ category_id: string, description: string }>) {
        //     return await sql`
        //         insert into steam_category ${
        //             sql(categories,
        //                 'category_id',
        //                 'description'
        //             )
        //         }
        //         on conflict do nothing

        //         returning *
        //     `;
        // }
    };
};