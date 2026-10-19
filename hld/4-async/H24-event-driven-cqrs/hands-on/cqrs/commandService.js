const express = require("express");
const kafka = require("kafka-node");

const app = express();
app.use(express.json());

// Kafka Producer Setup
const client = new kafka.KafkaClient({ kafkaHost: "localhost:9092" });
const producer = new kafka.Producer(client);

// Ensure Kafka is ready
producer.on("ready", () => console.log("✅ Kafka Producer is ready"));
producer.on("error", (err) => console.error("Kafka Producer Error:", err));

// Create Order API (Write)
app.post("/order", (req, res) => {
    const order = { orderId: Date.now(), product: req.body.product, quantity: req.body.quantity };
    
    producer.send([{ topic: "order-events", messages: JSON.stringify(order) }], (err, data) => {
        if (err) return res.status(500).send("❌ Kafka Error");
        console.log("📨 Order Created Event Sent:", order);
        res.status(201).send(order);
    });
});

app.listen(4000, () => console.log("🚀 Command Service Running on Port 4000"));