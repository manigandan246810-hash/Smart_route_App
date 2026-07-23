import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('CRITICAL ERROR: MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
}

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

export async function connectDB() {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            console.log(`Connecting to MongoDB Atlas (Attempt ${retries + 1}/${MAX_RETRIES})...`);
            await mongoose.connect(MONGODB_URI);
            console.log('====================================================');
            console.log(' SUCCESS: Connected to MongoDB Atlas Database!');
            console.log('====================================================');
            return;
        } catch (err) {
            retries++;
            console.error(`ERROR: Failed to connect to MongoDB on attempt ${retries}. Details: ${err.message}`);
            if (retries < MAX_RETRIES) {
                console.log(`Retrying database connection in ${RETRY_INTERVAL_MS / 1000} seconds...`);
                await new Promise(res => setTimeout(res, RETRY_INTERVAL_MS));
            } else {
                console.error('CRITICAL ERROR: Maximum connection retries exceeded. Exiting application.');
                process.exit(1);
            }
        }
    }
}
