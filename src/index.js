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
const collectionParticipants = db.collection("participants");
const collectionMessages = db.collection("messages");

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  try {
    const existingParticipant = await collectionParticipants.findOne({ name });

    if (existingParticipant) {
      res.status(409).send("name já está sendo usado!");
      return;
    }

    const { error } = nameSchema.validate({ name }, { abortEarly: false });

    if (error) {
      res
        .status(422)
        .send("name deve ser strings não vazio, e no minimo 3 caracteres!");
      return;
    }

    const participant = { name, lastStatus: Date.now() };
    const message = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    };

    await collectionParticipants.insertOne(participant);
    await collectionMessages.insertOne(message);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await collectionParticipants.find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const { error } = messageSchema.validate(
    { to, text, type },
    { abortEarly: false }
  );

  if (error) {
    res.status(422).send(error.message);
    return;
  }

  try {
    const useEx = await collectionParticipants.findOne({ name: user });

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
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.send("errr");
  }
});

app.get("/messages", async (req, res) => {
  const limitMessege = parseInt(req.query.limit);
  const user = req.headers.user;

  try {
    const messages = await collectionMessages.find().toArray();

    if (limitMessege) {
      const messageReturn = messages
        .reverse()
        .filter((message, index) => index < limitMessege);

      res
        .status(201)
        .send(
          messageReturn.filter(
            (msg) => msg.type === "message" || msg.to === user
          )
        );

      return;
    }

    res
      .status(201)
      .send(
        messages
          .reverse()
          .filter((msg) => msg.type === "message" || msg.to === user)
      );
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;

  try {
    const userOk = await collectionParticipants.findOne({ name: user });

    if (!userOk) {
      res.sendStatus(400);
    }

    collectionParticipants.updateOne(userOk, {
      $set: {
        ...userOk,
        lastStatus: Date.now(),
      },
    });
    res.status(200).send(userOk);
  } catch (err) {
    console.log(err);
    res.sendStatus(401);
  }
});

setInterval(async (res) => {
  try {
    const participants = await collectionParticipants.find().toArray();

    const participantStatus = participants.map(
      (participant) => participant.lastStatus
    );

    const maxOffTime = 10.0;

    const participantsOff = participantStatus.filter(
      (status) => (Date.now() / 1000 - status / 1000).toFixed(0) > maxOffTime
    );

    participantsOff.forEach(async (participant) => {
      try {
        const participantDelete = await collectionParticipants.findOne({
          lastStatus: participant,
        });

        await collectionMessages.insertOne({
          from: participantDelete.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        });

        await collectionParticipants.deleteOne({ lastStatus: participant });
      } catch (err) {
        console.log(err);
      }
    });
  } catch (err) {
    console.log(err);
  }
}, 15000);

app.listen(5000, () => console.log("app running port: 5000"));
