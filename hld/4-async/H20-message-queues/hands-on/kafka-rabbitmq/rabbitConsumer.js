const amqp = require("amqplib");

async function receiveOrder() {
    const connection = await amqp.connect("amqp://localhost");
    const channel = await connection.createChannel();

    const queue = "orderQueue";
    await channel.assertQueue(queue, { durable: false });

    console.log("📥 RabbitMQ Consumer is waiting...");
    channel.consume(queue, (msg) => {
        console.log("📥 RabbitMQ Event Received:", JSON.parse(msg.content.toString()));
    }, { noAck: true });
}

receiveOrder();