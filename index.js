import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from 'cors'
import cookieParser from "cookie-parser";
import { UserRouter } from "./routes.js/user.js";
const app = express();
dotenv.config();
app.use(cors({
  origin: ['https://placify-rho.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  credentials: true 
}))
app.use(cookieParser())
app.use(express.json()); 
app.use("/auth", UserRouter);
try {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("DB Connection Successful");
} catch (err) {
  console.error("DB Connection Error:", err);
}
app.listen(process.env.PORT, () => {
  console.log(`Server is running`);
});
