import * as mqtt from 'mqtt';

// MQTT broker URL
const brokerUrl = 'mqtt://localhost:1883';

// Create a client instance
const client = mqtt.connect(brokerUrl);

// Topic to subscribe and publish to
const topic = 'test/topic';

// Event handler for successful connection
client.on('connect', () => {
  console.log('Connected to MQTT broker');

  // Subscribe to the topic
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('Subscription error:', err);
    } else {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });

  // Publish a message to the topic
  const message = 'Hello MQTT';
  client.publish(topic, message, (err) => {
    if (err) {
      console.error('Publish error:', err);
    } else {
      console.log(`Message published to topic: ${topic}`);
    }
  });
});

// Event handler for receiving messages
client.on('message', (receivedTopic, message) => {
  if (receivedTopic === topic) {
    console.log(`Received message: ${message.toString()}`);
  }
});

// Event handler for connection errors
client.on('error', (err) => {
  console.error('Connection error:', err);
});
