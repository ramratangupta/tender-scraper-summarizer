import dotenv from "dotenv";
import { createClient } from "redis";
dotenv.config();
const redis = await createClient({ url: process.env.REDIS_URL }).connect();
const ke = await redis.keys("*");
console.log(ke);
