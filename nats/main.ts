
import { connect, StringCodec, NatsConnection, Subscription } from 'nats';

// NATS server URL
const serverUrl = 'nats://localhost:4222';

// Create a connection to the NATS server
async function start() {
  const nc: NatsConnection = await connect({ servers: serverUrl });
  console.log('Connected to NATS server');

  const sc = StringCodec();

  // Subscribe to a subject
  const subject = 'test.subject';
  const sub: Subscription = nc.subscribe(subject);
  (async () => {
    for await (const m of sub) {
      console.log(`Received message: ${sc.decode(m.data)}`);
    }
  })();

  // Publish a message to the subject
  const message = 'Hello NATS';
  nc.publish(subject, sc.encode(message));
  console.log(`Message published to subject: ${subject}`);

  // Close the connection after a while
  setTimeout(() => {
    nc.close();
    console.log('Connection closed');
  }, 5000);
}

// Start the NATS client
start().catch((err) => {
  console.error('Error connecting to NATS server:', err);
});
