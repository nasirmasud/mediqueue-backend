const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    const db = client.db("mediqueue");
    const tutorCollection = db.collection("tutors");
    const tutorBookingCollection = db.collection("tutorBookings");

    // Search & Filtering API
    app.get("/tutors", async (req, res) => {
      const { search, subject, city, price, mode } = req.query;
      const filter = {};

      if (search)
        filter.$or = [
          { tutorName: { $regex: search, $options: "i" } },
          { subject: { $regex: search, $options: "i" } },
          { institution: { $regex: search, $options: "i" } },
        ];

      if (subject) filter.subject = subject;
      if (city) filter.district = city;
      if (mode) filter.teachingMode = mode;

      if (price) {
        const [min, max] = price.split("-").map(Number);
        filter.hourlyFee = { $gte: min, $lte: max };
      }

      const tutors = await tutorCollection.find(filter).toArray();
      res.json(tutors);
    });

    // Single Tutor API
    app.get("/tutors/:id", async (req, res) => {
      const { id } = req.params;
      const result = await tutorCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // Featured Tutor API
    app.get("/featured-tutors", async (req, res) => {
      const tutors = await tutorCollection.find().limit(6);
      const result = await tutors.toArray();
      res.send(result);
    });

    // Create Tutor API
    app.post("/tutors", async (req, res) => {
      const tutorData = req.body;
      const result = await tutorCollection.insertOne(tutorData);
      res.json(result);
    });

    // Tutor Profile Update
    app.put("/tutors/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const result = await tutorCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.json(result);
    });

    // Tutor Profile Delete
    app.delete("/tutors/:id", async (req, res) => {
      const { id } = req.params;
      const result = await tutorCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });
  } catch (error) {
    console.error(error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
