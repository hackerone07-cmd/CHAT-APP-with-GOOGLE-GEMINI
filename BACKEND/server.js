import dotenv from "dotenv";
dotenv.config();    
import http from "http";
import app from "./app.js";


const port = process.env.PORT || 3000;

const server   = http.createServer(app);

server.listen(3000,(req,res)=>{
    console.log(`server running on port ${port}`);    
})