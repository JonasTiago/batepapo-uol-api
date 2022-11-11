import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import joi from "joi";

const nameSchema = joi.object({
  name: joi.string().min(3).required(),
});

const messageSchema = joi.object({
  to: joi.string().min(2).required(),
  text: joi.string().min(2).required(),
  type: joi.string().valid("message", "private_message").required(),
});

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

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const { error } = nameSchema.validate({ name }, { abortEarly: false });

  if (error) {
    res
      .status(422)
      .send("name deve ser strings não vazio, e no minimo 3 caracteres!");
    return;
  }

  const participant = { name, lastStatus: Date.now() };

  try {
    const existingParticipant = await conllectionParticipants.findOne({ name });

    if (existingParticipant) {
      res.status(409).send("name já está sendo usado!");
      return;
    }

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
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const { error } = messageSchema.validate({ to, text, type });

  if (error) {
    res.status(422).send(error.message);
    return;
  }

  try {
    const useEx = await conllectionParticipants.findOne({ name: user });

    if (!useEx) {
      res.sendStatus(422);
      return;
    }

    const message = {
      from: user,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    };

    await collectionMessages.insertOne(message);
    res.sendStatus(201)
  } catch (err) {
    console.log(err);
    res.send("errr");
  }
});

// app.get("/messages", async (req, res) => {
//   try {
//     const messages = await collectionMessages.find().toArray();
//     res.status(201).send(messages);
//   } catch (err) {
//     console.log(err);
//     res.sendStatus(500);
//   }
// });

// app.post("/status", async (req, res) => {
//   //remover user
// });

app.listen(5000, () => console.log("app running port: 5000"));
