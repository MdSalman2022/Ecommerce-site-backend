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
        const userCollection = client.db("BestDeal").collection("userCollection");
        const reviewCollection = client.db("BestDeal").collection("reviewCollection");



        app.get('/getusers', async (req, res) => {
            const cursor = userCollection.find({})
            const users = await cursor.toArray()
            res.send(users)
        })

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

        app.get('/orderhistory', async (req, res) => {
            const cursor = OrderCollection.find({})
            const orders = await cursor.toArray()
            res.send(orders)
        })

        app.get('/get-review', async (req, res) => {
            const cursor = reviewCollection.find({})
            const reviews = await cursor.toArray()
            res.send(reviews)
        })

        // delete many 
        app.delete('/delete', async (req, res) => {
            const ids = req.body.ids;
            const objectIds = ids.map(id => new ObjectId(id));
            const result = await productCollection.deleteMany({ _id: { $in: objectIds } });
            res.send(result);
        });




        app.put('/update/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: req.body.name,
                    price: req.body.price,
                    stock: req.body.stock,
                }
            }
            const result = await productCollection.updateOne(filter, updatedDoc, { upsert: false })
            res.json(result)
        })

        // put date value to every product
        // app.put('/addDate', async (req, res) => {
        //     const date = new Date().toDateString()
        //     const query = { date: date }
        //     const result = await productCollection.updateMany({}, { $set: query })
        //     res.json(result)
        // })
        // app.put('/addSub', async (req, res) => {
        //     const filter = { subcat: "mouse", brand: "hp" }
        //     const updatedDoc = {
        //         $set: { 
        //             brand: "razer"
        //         }
        //     }
        //     const result = await productCollection.updateMany(filter, updatedDoc)
        //     res.send(result)
        // })





        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

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

        //review post
        app.post('/post-review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review)
            console.log(result)
            res.send(result)
        })


        app.post('/addproduct', async (req, res) => {
            const data = req.body;
            const result = await productCollection.insertOne(data)
            res.send(result)
        })


        // get user info and save it in database 
        app.post('/adduser', async (req, res) => {
            const data = req.body;
            const alldata = {
                ...data,
                date: new Date().toDateString()
            }
            const result = await userCollection.insertOne(alldata)
            res.send(result)
        })


        app.put('/userdata', async (req, res) => {
            try {
                const email = req.body.email;

                const cardnumber = req.body.cardnumber;

                const filter = { email: email };

                const update = {
                    $set: {
                        cardnumber: cardnumber,
                    }
                };
                const options = { upsert: true };
                const result = await userCollection.updateOne(filter, update, options);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'An error occurred while updating the user information' });
            }
        });

        app.put('/deliveryInfo', async (req, res) => {
            try {
                const email = req.body.email;

                const address = req.body?.address;
                const orderName = req.body?.orderName;
                const contact = req.body?.contact;
                const city = req.body?.city;

                const filter = { email: email };

                const update = {
                    $set: {
                        orderName: orderName,
                        address: address,
                        contact: contact,
                        city: city
                    }
                };
                const options = { upsert: true };
                const result = await userCollection.updateOne(filter, update, options);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'An error occurred while updating the user information' });
            }
        });




        app.put('/orderstatus', async (req, res) => {
            try {
                const ids = req.body.ids;
                const status = req.body.status;

                const objectIds = ids.map(id => new ObjectId(id));
                const filter = { _id: { $in: objectIds } };
                const update = {
                    $set: {
                        shipment: status,
                        orderStatus: true
                    }
                };
                const options = { upsert: true };

                const result = await OrderCollection.updateMany(filter, update, options);

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'An error occurred while updating the order status' });
            }
        });

        app.put('/orderCancel', async (req, res) => {
            try {
                const ids = req.body.ids;
                const status = req.body.status;

                const objectIds = ids.map(id => new ObjectId(id));
                const filter = { _id: { $in: objectIds } };
                const update = { $set: { orderStatus: false } };
                const options = { upsert: true };

                const result = await OrderCollection.updateMany(filter, update, options);

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'An error occurred while updating the order status' });
            }
        });


        app.delete('/deleteOrder', async (req, res) => {
            const ids = req.body.ids;
            const objectIds = ids.map(id => new ObjectId(id));
            const result = await OrderCollection.deleteMany({ _id: { $in: objectIds } });
            res.send(result);
        });

    } catch (err) {
        console.log(err)
    }

}


run().catch(console.log)





app.listen(port, () => console.log(`bestdea portal is running on ${port}`))