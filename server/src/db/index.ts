import { Pool } from "pg";
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
	user: 'postgres',
	password: process.env.POSTGRE_PASSWORD,
	host: 'localhost',
	port: 5432,
	database: 'chat_app',
};

// Create a new PostgreSQL client
export const pool = new Pool(dbConfig);