/**
 * Postgres connection pool (server-side only — see docker-compose.yml and
 * init.sql). Not wired into the app yet: all persistence currently runs
 * client-side in IndexedDB. Kept as the data layer's future network/database
 * adapter; credentials come from the environment with docker-compose defaults.
 */

import pg from 'pg';

const pool = new pg.Pool({
	user: process.env.POSTGRES_USER ?? 'zenith_user',
	password: process.env.POSTGRES_PASSWORD ?? 'zenith_password',
	host: process.env.POSTGRES_HOST ?? 'localhost', // 'db' if the app itself runs inside docker
	database: process.env.POSTGRES_DB ?? 'zenith_db',
	port: Number(process.env.POSTGRES_PORT ?? 5432)
});

export const database = {
	query: (text: string, params: unknown[] = []) => pool.query(text, params)
};
