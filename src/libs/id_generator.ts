import { Worker } from 'snowflake-uuid';

export const generator = new Worker(0, 1, {
	workerIdBits: 5,
	datacenterIdBits: 5,
	sequenceBits: 12,
});