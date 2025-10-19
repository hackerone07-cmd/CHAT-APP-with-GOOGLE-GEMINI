import express from "express";
import morgan from "morgan";
import connect from "./db/db.js";
import userRouter from "./routes/user.routes.js";
import cookieParser from "cookie-parser";


connect();
const app = express();


app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());


app.use('/users',userRouter);


app.get("/",(req,res)=>{
    res.send("hello to the world");
})


export default app;