import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
// import dayjs from "dayjs";
// import Joi from "joi";

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient("mongodb://localhost:27017"); //servidor local

try {
  await mongoClient.connect();
  console.log("MongoDB Conectado!");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db("batePapoUol");
const conllectionParticipants = db.collection("participants");
const collectionMessages = db.collection("messages");

// const nameSchema = Joi.object({
//   name: Joi.string().min(3).required(),
// });

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const participant = { name, lastStatus: Date.now() };

  try {
    await conllectionParticipants.insertOne(participant);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await conllectionParticipants.find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const message = {
    from: user,
    to,
    text,
    type,
    time: dayjs().format("HH:mm:ss"),
  };
  try {
    await collectionMessages.insertOne(message);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.send("errr");
  }
});

app.listen(5000, () => console.log("app running port: 5000"));
