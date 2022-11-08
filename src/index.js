import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("test");
});

app.listen(5000, () => console.log("app running port: 5000"));
