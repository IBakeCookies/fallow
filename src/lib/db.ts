import pg from 'pg';

const pool = new pg.Pool({
	user: 'zenith_user',
	password: 'zenith_password',
	host: 'localhost', // Switch to 'db' if running the entire SvelteKit app inside docker
	database: 'zenith_db',
	port: 5432
});

export const db = {
	query: (text: string, params = []) => pool.query(text, params)
};
