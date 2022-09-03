import { dotenv, postgres } from '../deps.ts';

const {
    PG_USERNAME,
    PG_PASSWORD,
    PG_DB,
    PG_HOST,
    PG_PORT
} = await dotenv.config({ safe: true });

export const sql = postgres({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DB,
    username: PG_USERNAME,
    password: PG_PASSWORD
});