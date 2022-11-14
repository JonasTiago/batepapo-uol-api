import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import joi from "joi";
import dotenv from "dotenv";
/*bonus*/
import { stripHtml } from "string-strip-html";

const nameSchema = joi.object({
  name: joi.string().min(3).required(),
});

const messageSchema = joi.object({
  to: joi.string().min(2).required(),
  text: joi.string().min(2).required(),
  type: joi.string().valid("message", "private_message").required(),
});

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI); //servidor local

try {
  await mongoClient.connect();
  console.log("MongoDB Conectado!");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db("batePapoUol");
const collectionParticipants = db.collection("participants");
const collectionMessages = db.collection("messages");

setInterval(async () => {
  try {
    const participants = await collectionParticipants.find().toArray();

    const participantStatus = participants.map(
      (participant) => participant.lastStatus
    );

    const maxOffTime = 10;

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

app.post("/participants", async (req, res) => {
  const name = stripHtml(req.body.name).result;

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
      from: name.trim(),
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    };

    await collectionParticipants.insertOne(participant);
    await collectionMessages.insertOne(message);
    res.status(201).send("criado");
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
  const to = stripHtml(req.body.to).result;
  const text = stripHtml(req.body.text).result;
  const type = stripHtml(req.body.type).result;
  const { user } = req.headers;

  console.log(to);

  const { error } = messageSchema.validate(
    { to, text, type },
    { abortEarly: false }
  );

  if (error) {
    res.status(422).send(error.details.map((detail) => detail.message));
    return;
  }

  try {
    const useEx = await collectionParticipants.findOne({ name: user });

    if (!useEx) {
      res.sendStatus(422);
      return;
    }

    const message = {
      from: user.trim(),
      to: to.trim(),
      text: text.trim(),
      type: type.trim(),
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
  const { user } = req.headers;

  try {
    const messages = await collectionMessages.find().toArray();

    if (limitMessege <= messages.length) {
      const messagesForUser = messages.filter(
        (msg) =>
          !(msg.type === "private_message") ||
          msg.to === user ||
          msg.from === user
      );
      const messageLimitUser = messagesForUser.reverse().slice(0, limitMessege);

      res.status(201).send(messageLimitUser.reverse());
      return;
    }

    res
      .status(201)
      .send(
        messages.filter(
          (msg) =>
            !(msg.type === "private_message") ||
            msg.to === user ||
            msg.from === user
        )
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

//bonus delete
app.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;

  try {
    const message = await collectionMessages.findOne({ _id: ObjectId(id) });
    if (!message) {
      res.sendStatus(404);
      return;
    }

    const confirmUser = message.from === user;
    if (!confirmUser) return res.sendStatus(401);

    await collectionMessages.deleteOne({ _id: ObjectId(id) });
    res.status(200).send({ message: "Documento apagado com sucesso!" });
  } catch (err) {
    console.log(err);
    res.sendStatus(404);
  }
});

//bonus put/edit
app.put("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;
  const { to, text, type } = req.body;

  const { error } = messageSchema.validate(
    { to, text, type },
    { abortEarly: false }
  );

  if (error) {
    res.status(422).send(error.details.map((detail) => detail.message));
    return;
  }
  try {
    const userOk = await collectionParticipants.findOne({ name: user });
    if (!userOk) return res.sendStatus(422);

    const messageFound = await collectionMessages.findOne({
      _id: ObjectId(id),
    });
    if (!messageFound) return res.sendStatus(404);

    const confirmUser = messageFound.from === user;
    if (!confirmUser) return res.sendStatus(401);

    await collectionMessages.updateOne(
      { _id: messageFound._id },
      {
        $set: {
          to,
          text,
          type,
        },
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});

app.listen(5000, () => console.log("app running port: 5000"));
