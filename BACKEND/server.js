import "dotenv/config.js";    
import http from "http";
import app from "./app.js";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import ProjectModel from "./models/Project.model.js";
import { generateResult } from "./services/ai.service.js";
import { measureMemory } from "vm";
import { sensitiveHeaders } from "http2";
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

io.on("connection", (socket)=>{
   
    socket.join(socket.projectId._id.toString());
    console.log("a user connected");
  
    socket.on("project-message", async(data)=>{
        const message = data.message;
        console.log("message received:", message);

        const aiPresentInMessage = message.toLowerCase().includes("@ai"); 

        if(aiPresentInMessage) {
            // Send typing indicator
            socket.emit("project-message", {
                message: "AI is typing...",
                sender: "AI Assistant",
                timestamp: new Date().toISOString()
            });

            const prompt = message.replace('@ai', '').trim();
            const aiResponse = await generateResult(prompt);
            
            io.to(socket.projectId._id.toString()).emit("project-message", {
                message: aiResponse,
                sender: "AI Assistant",
                timestamp: new Date().toISOString()
            });
        } else {
            // Forward regular messages with proper structure
            socket.broadcast.to(socket.projectId._id.toString()).emit("project-message", {
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    socket.on("disconnect",()=>{
        console.log("user disconnected");
        socket.leave(socket.projectId._id.toString());
    });
});


server.listen(3000,(req,res)=>{
    console.log(`server running on port ${port}`);    
})