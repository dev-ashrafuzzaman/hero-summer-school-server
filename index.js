const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;
// Vercel All Okay but Slow And Some Time Not Responce
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
        const discountClassesCollection = client.db("heroAcademy").collection("discountClasses");
        const usersCollection = client.db("heroAcademy").collection("users");
        const selectedCollection = client.db("heroAcademy").collection("selected");
        const paymentCollection = client.db("heroAcademy").collection("payments");


        // JWT TOKEN
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })
            res.send({ token });
        });


        // warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next()
        }

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })


        // warning: use verifyJWT before using verifyInstructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next()
        }

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })



        // User APIS
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/instructor', async (req, res) => {
            const instructorArray = await usersCollection.find().toArray();
            const result = instructorArray.filter(instructor => instructor.role === 'instructor')
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const users = req.body;
            const query = { email: users.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(users);
            res.send(result)
        });

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const userUpdate = req.body;
            const updateUserDetails = {
                $set: {
                    role: userUpdate.role,
                }
            }
            const result = await usersCollection.updateOne(filter, updateUserDetails);
            res.send(result)
        })


        // classes collection APIS
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass)
            res.send(result)
        })

        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const classUpdateFeedback = req.body;
            const classUpdateDetails = {
                $set: {
                    feedback: classUpdateFeedback.feedback,
                }
            }
            const result = await classesCollection.updateOne(filter, classUpdateDetails, options);
            res.send(result)
        })
        app.patch('/classes/status/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const classUpdatestatus = req.body;
            const classUpdateDetails = {
                $set: {
                    status: classUpdatestatus.status,
                }
            }
            const result = await classesCollection.updateOne(filter, classUpdateDetails, options);
            res.send(result)
        })

        app.get('/myClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classesCollection.findOne(query);
            res.send(result);
        })

        app.get('/myClasses', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            const query = { email: email }
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        });

        app.patch('/myClasses/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const classUpdate = req.body;
            const updateClassDetails = {
                $set: {
                    name: classUpdate.name,
                    price: classUpdate.price,
                    availableSeats: classUpdate.availableSeats,
                    instructorName: classUpdate.instructorName,
                    image: classUpdate.image,
                    email: classUpdate.email,
                    status: classUpdate.status,
                    totalEnroll: classUpdate.totalEnroll,

                }
            }
            const result = await classesCollection.updateOne(filter, updateClassDetails, options);
            res.send(result)
        })


        // Discount Classes Apis
        app.get('/discountClasses', async (req, res) => {
            const result = await discountClassesCollection.find().toArray();
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
            console.log(myclassesIds)
            const updateResult = await classesCollection.updateMany(
                { _id: { $in: myclassesIds }, availableSeats: { $gt: 0 }, totalEnroll: { $gte: 0 } },
                { $inc: { availableSeats: -1, totalEnroll: 1 } }
            );

            res.send({ insertResult, deleteResult, updateResult });
        });


        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const totalClasses = await classesCollection.estimatedDocumentCount();
            const totalOrders = await paymentCollection.estimatedDocumentCount();

            const instructorArray = await usersCollection.find().toArray();
            const SingleInstructor = instructorArray.filter(instructor => instructor.role === 'instructor')
            const totalInstructor = SingleInstructor.length;

            const approvedArray = await classesCollection.find().toArray();
            const Singleapproved = approvedArray.filter(approved => approved.status === 'approved')
            const totalApproved = Singleapproved.length;

            const pendingArray = await classesCollection.find().toArray();
            const Singlepending = pendingArray.filter(pending => pending.status === 'pending')
            const totalpending = Singlepending.length;

            const deniedArray = await classesCollection.find().toArray();
            const Singledenied = deniedArray.filter(denied => denied.status === 'denied')
            const totaldenied = Singledenied.length;

            const payments = await paymentCollection.find().toArray();
            const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);
            const totalRevenue = parseFloat(revenue.toFixed(2));

            const populerClasses = await classesCollection
                .find()
                .sort({ totalEnrolled: -1 })
                .limit(5)
                .toArray();

            res.send({
                totalRevenue, users, totalClasses, totalInstructor, SingleInstructor, totaldenied, totalOrders, totalApproved, totalpending, populerClasses
            })
        })

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