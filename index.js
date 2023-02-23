const express = require('express'); 
const cors = require('cors');

const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000



app.use(express.json())
app.use(cors())


app.get('/', async (req, res) => {
    res.send('bestdeal portal server is running')
})
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cwkrobe.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() { 
    try {
        
        const productCollection = client.db("BestDeal").collection("productCollection");
        const OrderCollection = client.db("BestDeal").collection("OrderHistory");
        

        //get all products
        app.get('/products', async (req, res) => {
            const cursor = productCollection.find({})
            const products = await cursor.toArray()
            res.send(products)
        })
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.findOne(query)
            res.send(result)
        })

        // put date value to every product
        app.put('/addstock', async (req, res) => {
            const stock = true;
            const query = { stock: stock }
            const result = await productCollection.updateMany({}, { $set: query })
            res.json(result)
        })
        app.put('/addSub', async (req, res) => {
            const filter = { subcat: "mouse", brand: "hp" }
            const updatedDoc = {
                $set: { 
                    brand: "razer"
                }
            }
            const result = await productCollection.updateMany(filter, updatedDoc)
            res.send(result)
        })
            

        app.get('/search', async (req, res) => {
            const name = req.query.name;
            console.log(name);
            let query = {}
            if (req.query.name) {
                query = {
                    name: { $regex: name, $options: 'i' }
                }
            }
            const result = await productCollection.find(query).toArray()
            res.send(result)
        })


        app.post('/create-payment-intent', async (req, res) => { 
            const {price} = req.body;
            console.log(typeof(price))
            const amount = price * 100;
            console.log(amount)
            console.log(typeof(amount))

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/orderhistory', async (req, res) => {
            const order = req.body;
            const result = await OrderCollection.insertOne(order)
            res.send(result)
        })

        app.get('/orderhistory', async (req, res) => {
            const cursor = OrderCollection.find({})
            const orders = await cursor.toArray()
            res.send(orders)
        })


        
    }catch(err) {
        console.log(err)
    }

}


run().catch(console.log)





app.listen(port, () => console.log(`bestdea portal is running on ${port}`))