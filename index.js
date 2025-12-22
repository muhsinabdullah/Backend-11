const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//middleware
const verifyFBToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }

    const token = authHeader.split(' ')[1];

    const decodedUser = await admin.auth().verifyIdToken(token);

    req.decoded_email = decodedUser.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
}



const uri = process.env.MONGO_URI || "mongodb+srv://missionscic11:l7W25T0psd2kVyKs@cluster0.a2ybfki.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const database = client.db('missionscic11DB');
    const userCollection = database.collection('user');
    const requestCollection = database.collection('requests');

    console.log("MongoDB connected");

    // Register User
    app.post('/users', async (req, res) => {
      try {
        const { name, email, password, mainPhotoUrl, bloodGroup, district, upazila } = req.body;

        if (!email || !password) {
          return res.status(400).send({ message: 'Email and password are required' });
        }

        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).send({ message: 'User already exists' });
        }

        const userInfo = {
          name: name || '',
          email,
          password,
          photoURL: mainPhotoUrl || '',
          bloodGroup: bloodGroup || '',
          district,
          upazila,
          role: 'donar',
          status: 'active',
          createdAt: new Date()
        };

        const result = await userCollection.insertOne(userInfo);
        res.status(201).send({ message: 'User registered successfully', userId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });
        
    // Login User
    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send({ message: 'Email and password required' });

        const user = await userCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: 'User not found' });

        if (user.password !== password) return res.status(401).send({ message: 'Incorrect password' });

        res.send({ message: 'Login successful', user });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.get('/users', verifyFBToken, async (req, res) =>{
      const result = await userCollection.find().toArray();
      res.status(200).send(result)
    })

    
    app.get('/users/role/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: 'User not found' });
        res.send({ role: user.role });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.patch('/update/user/status', verifyFBToken, async (req, res)=>{
      const {email, status} = req.query;
      const query = {email:email}
      const updateStatus = {
        $set: {
          status: status
        }
      }
       const result = await userCollection.updateOne(query, updateStatus)
       res.send(result)
    })

    // request
    app.post('/request', verifyFBToken, async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      const result = await requestCollection.insertOne(data)
      res.send(result)
    })

app.get('/my-request', verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;

    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 10;

    const query = { requesterEmail: email };

    const result = await requestCollection
      .find(query)
      .skip(page * size)
      .limit(size)
      .sort({ createdAt: -1 })
      .toArray();
    const totalRequest = await requestCollection.countDocuments(query);

    res.status(200).send({request: result, totalRequest});
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. MongoDB is working!");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
