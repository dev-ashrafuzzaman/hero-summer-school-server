const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

// middleWire
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Hero Language School Server is Running')
})

app.listen(port, () => {
    console.log(`Hero Language School Server Running on port ${port}`);
})