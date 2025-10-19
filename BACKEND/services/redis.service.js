import Redis from "ioredis";


const redisClient  = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
});

redisClient.on('connect',()=>{
      console.log('redis connected')
})

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

export default redisClient;