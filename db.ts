import { postgres } from './deps.ts';

export const db = (config) => {
    const sql = postgres(config);
};