import "dotenv/config.js";    
import http from "http";
import app from "./app.js";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import ProjectModel from "./models/Project.model.js";
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin:"*"
    }
});

io.use(async(socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers["authorization"]?.split(" ")[1];
        const projectId = socket.handshake.query?.projectId;

        // Validate token
        if(!token){
            return next(new Error("Authentication error"));
        }

        // Validate project ID
        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error("Invalid project ID"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded){
            return next(new Error("Authentication error"));
        }

        // Store both user and project ID in socket
        socket.user = decoded;
        socket.projectId = await ProjectModel.findOne({_id: projectId});
        next();
    } catch (err) {
        console.log("Socket authentication error:", err);
        next(new Error("Authentication failed"));
    }
});

io.on("connection",(socket)=>{
    console.log("a user connected");
    socket.join(socket.projectId._id.toString());
    socket.on("project-message",(data)=>{
        console.log({data})
        socket.broadcast.to(socket.projectId._id.toString()).emit("project-message",data);
    });
    
    socket.on("event", data => { 
        console.log("event received:", data);
    });
    socket.on("disconnect",()=>{
        console.log("user disconnected");
    });
});


server.listen(3000,(req,res)=>{
    console.log(`server running on port ${port}`);    
})