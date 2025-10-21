import express from "express";
import morgan from "morgan";
import connect from "./db/db.js";
import userRouter from "./routes/user.routes.js";
import projectRoutes from "./routes/Project.route.js"
import cookieParser from "cookie-parser";
import cors from "cors";

connect();
const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());


app.use('/users',userRouter);
app.use('/projects', projectRoutes);

app.get("/",(req,res)=>{
    res.send("hello to the world");
})


export default app;