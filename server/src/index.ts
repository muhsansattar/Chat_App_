import express, { Application, Request, Response } from 'express';
import cors from "cors";
import authRouter from "./routers/authRouter";
import roomsRouter from "./routers/roomsRouter";
import messagesRouter from "./routers/messagesRouter";
import session from "express-session";
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { pool } from './db';
import { authorizeTokenSocket } from './middleware/auth';
import { handleMessage } from './sockets/messages';
import { handleJoinRoom, handleLeaveRoom } from './sockets/rooms';
import cookieParser from "cookie-parser";
import { handleChangeOnlineState } from './sockets/connection';


dotenv.config();
const app: Application = express();
const port: number = 3000;
const server = createServer(app);
export const io = new Server(server, {cors: {
  origin: "http://localhost:5173",
  methods: ["GET", "POST"],
  allowedHeaders: ["Authorization"],
  credentials: true
}});

// MIDDLEWAREs
const corsOptions ={
  origin:'http://localhost:5173', 
  credentials:true,            //access-control-allow-credentials:true
  optionSuccessStatus:200
}
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(session({
  secret: process.env.COOKIE_SECRET || "",
  name: "sid",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.ENVIRONMENT === "production",
    httpOnly: true,
    sameSite: process.env.ENVIRONMENT === "production" ? "none" : "lax",
  }
}));


// ROUTES
app.use("/auth", authRouter);         // auth - login, signup
app.use("/rooms", roomsRouter);       // rooms - create, delete, join
app.use("/messages", messagesRouter); // messages - send, get, delete, edit


// SOCKETS
io.use(authorizeTokenSocket);

io.on('connection', (socket) => {
  // Handle incoming messages
  socket.on('message', async (msg) => {
    const isDone = await handleMessage(msg, "user", socket);
    if(!isDone) {
      socket.emit("error", { message: "Must be a member!" });
    }
  });

  // join room
  socket.on("join-room", async (msg) => {
    await handleChangeOnlineState(true, socket);
    console.log("changed state");
    const isDone = await handleJoinRoom(msg, socket);
    if(!isDone) {
      socket.emit("error", { message: "" });
    }
  });

  // leave room
  socket.on("leave-room", async (msg) => {
    const isDone = await handleLeaveRoom(msg, socket);
    if(!isDone) {
      socket.emit("error", { message: "" });
    }
  });


  socket.on('disconnect', async () => {
    console.log('user disconnected');
    // set is_online to false
    await handleChangeOnlineState(false, socket);
  });
});


server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});