const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleWire
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorize access' });
    }

    // brarer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorize access' });
        }
        req.decoded = decoded;
        next();
    })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vin9bep.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const classesCollection = client.db("heroAcademy").collection("classes");
        const selectedCollection = client.db("heroAcademy").collection("selected");
        const paymentCollection = client.db("heroAcademy").collection("payments");


        // JWT TOKEN
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })
            res.send({ token });
        })

        // classes collection APIS
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })



        // selected APIS

        app.get('/selected', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            const query = { email: email }
            const result = await selectedCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/selected', async (req, res) => {
            const classes = req.body;
            console.log(classes);
            const result = await selectedCollection.insertOne(classes);
            res.send(result)
        })

        app.delete('/selected/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedCollection.deleteOne(query);
            res.send(result);
        })


        // Enrolled Apis
        app.get('/enrolled', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });



        // Payment 
        app.get('/payment', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });

        // Payment getway Setup intent APIS
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // Payment releted apis
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;

            const insertResult = await paymentCollection.insertOne(payment);

            const selectedClassIds = payment.selectedClasses.map(id => new ObjectId(id));
            const query = { _id: { $in: selectedClassIds } };
            const deleteResult = await selectedCollection.deleteMany(query);

            // Update classesCollection with enrolled classes
            const myclassesIds = payment.classes.map(id => new ObjectId(id))
            const updateResult = await classesCollection.updateMany(
                { _id: { $in: myclassesIds }, availableSeats: { $gt: 0 }, totalEnroll: { $gt: 0 } },
                { $inc: { availableSeats: -1, totalEnroll: 1 } }
            );

            res.send({ insertResult, deleteResult, updateResult });
        });



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);








app.get('/', (req, res) => {
    res.send('Hero Language School Server is Running')
})

app.listen(port, () => {
    console.log(`Hero Language School Server Running on port ${port}`);
})