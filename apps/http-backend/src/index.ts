import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import roomRouter from "./routes/room";
import chatRouter from "./routes/chat";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);
app.use("/room", roomRouter);
app.use("/chat", chatRouter);

app.listen(4000, () => {
  console.log("Server started on port 3000");
});
