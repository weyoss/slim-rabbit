# SlimRabbit

A Node.js micro-services framework based on RabbitMQ. Being heavily inspired by KOA, SlimRabbit is a
simple yet powerful foundation with a very small footprint (~290 SLOC codebase) which tries to helps you build
lightning fast micro-services with elegance.

# Installation

```text
npm install slim-rabbit --save
```
SlimRabbit requires node v7.6.0 or higher for ES2015 and async function support.

# Application API Reference

## Middleware

A SlimRabbit application is an object containing an array of middleware functions which are composed and executed in a
stack-like manner once a message is delivered.

SlimRabbit is based on `koa-compose` node module and adopts the same vision and architecture as KOA framework which
is similar to many other middleware systems that you may have encountered, such as Connect, however it provides high
level "sugar" at the otherwise low-level middleware layer. This improves interoperability, robustness, and makes
writing middleware much more enjoyable.

The obligatory hello world application:

```js
const SlimRabbit = require('slim-rabbit');

const app = new SlimRabbit('test_queue');

app.on('consumer:error', (err, context) => {
    console.error(err);
});

app.use(async (ctx) => {
    const message = ctx.message;

    console.log(message);
    ctx.ack(message);
});

app.connect();
```

Middlewares can take two different kinds of functions as middleware:

***Async functions:***

```js
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});
```

***Common function which return promises:***

```js
app.use((ctx, next) => {
    const start = Date.now();
    return next().then(() => {
        const ms = Date.now() - start;
        console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
    });
});
```

## Context

Each middleware receives a `Context` object which encapsulates an incoming AMQP message and provides helpful
methods for working with AMQP prototocol.

A Context is created per message and many of its accessors and methods simply delegate to their ctx.message or
ctx.consumerChannel equivalents for convenience, and are otherwise identical.

### Context properties

#### ctx.app

Application instance reference.

#### ctx.state

The recommended namespace for passing information through middleware.

#### ctx.queueName

Application queue name from which the messages are consumed.

#### ctx.queueOpts

Application queue options. Queue options are the same options which amqplib `assertQueue` method accepts.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue

#### ctx.consumeOpts

Application consume's options. `consumeOpts` are the same options which amqplib `consume` method accepts.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_consume

#### ctx.message

Received message from RabbitMQ.

#### ctx.connection

The created amqplib connection to RabbitMQ server.

#### ctx.consumerChannel

The created amqplib channel for consuming messages.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel

#### ctx.publisherChannel

The created amqplib channel for publishing messages.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel

### Context methods

#### context.ack

Acknowledge the given message, or all messages up to and including the given message. Delegated to amqplib Channel#ack.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_ack

#### context.ackAll

Acknowledge all outstanding messages on the channel. Delegated to amqplib Channel#ackAll.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_ackAll

#### context.nack

Reject a message. This instructs the server to either requeue the message or throw it away. 
Delegated to amqplib Channel#nack.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_nack

#### context.nackAll

Reject all messages outstanding on this channel. Delegated to amqplib Channel#nackAll.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_nackAll

#### context.reject

Reject a message. Equivalent to context.nack(message, false, requeue), but works in older versions of RabbitMQ (< v2.3.0)
where context.nack does not.  Delegated to amqplib Channel#reject.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_reject

#### context.publish

Publish a single message to an exchange. The relevant method parameters are:

```text
/**
 *
 * @param {string} exchange
 * @param {string} routingKey
 * @param {(string|object|Buffer)} content
 * @param {object} options
 * @return {*}
 */
async publish(exchange, routingKey, content, options = {})
```

This method is the same as amqplib Channel#publish method except that [content] parameter can be of any javascript type. It is 
automatically converted to a Buffer instance.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish

#### context.sendToQueue

Send a single message with the content given as a buffer to the specific queue named, bypassing routing.
The options and return value are exactly the same as for context.publish.

```text
/**
 *
 * @param {string} queue
 * @param {(string|object|Buffer)} content
 * @param {object} options
 * @return {*}
 */
async sendToQueue(queue, content, options = {})
```

This method is the same as amqplib Channel#sendToQueue method except that [content] parameter can be of any javascript type. It is 
automatically converted to a Buffer instance.

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_sendToQueue

## Application

The object created when executing `new SlimRabbit(queueName, queueOpts, consumeOpts)` is known as the SlimRabbit
application object. The application class is the heart of SlimRabbit which run all the micro-service logic, manage
middlewares registration, handles errors as well as the configuration of the context, consumerChannel and publisherChannel objects.

Application accepts the following parameters:

- `queueName`: Queue name.
- `queueOpts`: Queue options. See http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue
- `consumeOpts`: Consume's options. See http://www.squaremobius.net/amqp.node/channel_api.html#channel_consume

```js
const queueOpts = {
    durable: true
};

const consumeOpts = {
    noAck: false,
    exclusive: true
};

const app = new SlimRabbit('test_queue', queueOpts, consumeOpts)
```

### app.use

Add a given middleware function to this application.

***Example:***

```js
app.use(async function (ctx, next) {
    try {
        const string = ctx.message.content.toString();
        ctx.message.content = string;
        ctx.message.content = JSON.parse(string);
    } catch (err) {}
    await next();
});
```

See [Middleware](https://github.com/weyoss/slim-rabbit#middleware)
 
### app.connect

Open a connection to the RabbitMQ server, create consumerChannel, publisherChannel and begin consuming messages from
the given queue. `app.connect` accepts the same parameters as amqplib `connect` method.

```text
/**
 *
 * @param {string} url
 * @param {object} socketOpts
 * @return {Promise.<void>}
 */
async connect(url, socketOpts = {}) 
```

See http://www.squaremobius.net/amqp.node/channel_api.html#connect

### app.context

`app.context` is the prototype from which ctx is created from. You may add additional properties to ctx by editing
app.context. This is useful for adding properties or methods to ctx to be used across your entire app, which may be
more performant (no middleware) and/or easier (fewer require()s) at the expense of relying more on ctx, which could
be considered an anti-pattern.

For example, to add a reference to your database from ctx:

```js
app.context.db = db();

app.use(async ctx => {
  console.log(ctx.db);
});
```

Note: Many properties on ctx are defined using getters and setters. You can only edit these properties (not recommended)
by using Object.defineProperty() on app.context.

### app.prefetch

Setup prefetch options for the application's consumer channel (consumerChannel).

```js
const SlimRabbit = require('slim-rabbit');

const app = new SlimRabbit('test_queue');

app.prefetch(20, false);

app.on('consumer:error', (err, context) => {
    console.error(err);
});

app.use(async (ctx) => {
    const message = ctx.message;

    console.log(message);
    ctx.ack(message);
});

app.connect();
```

See http://www.squaremobius.net/amqp.node/channel_api.html#channel_prefetch

### app.close

Close channels and disconnect from RabbitMQ.

## Error handling

An error handler is required to handle errors which may occur while consuming messages. Errors are emitted on the app.
To setup error-handling logic such as centralized logging you can add an "consumer:error" event listener.

***Simple error handler example:***

```js
app.on('consumer:error', (err, context) => {
    console.error(err);
});
```

***An advanced error handler can be such as:***

```js
app.on('consumer:error', (err, context) => {
    console.log(err);

    const message = context.message;
    const headers = message.properties.headers;
    const content = message.content;

    headers.hasOwnProperty('x-delivered-count') || (headers['x-delivered-count'] = 0);
    headers['x-delivered-count'] += 1;

    if (headers['x-delivered-count'] <= config.amqp.retriesThreshold) {
        console.log(`Message retries # ${headers['x-delivered-count']}. Re-queuing message...`);
        const {exchange, routingKey} = message.fields;
        context.publish(exchange, routingKey, content, {headers}).then(() => {
            context.ack(message);
        })
    } else {
        console.log('Message retries threshold exceeded. Purging message.');
        console.log('Message dump:', JSON.stringify(message));
        context.nack(message, false, false);
    }
});
```

## Events

The following events are emitted from the application during different stages of its lifecycle:

### connection:created

```js
app.on('connection:created', (connection) => {})
```

### connection:closed

```js
app.on('connection:closed', () => {})
```

### connection:error

```js
app.on('connection:error', (err) => {})
```

### consumer-channel:created

```js
app.on('consumer-channel:created', (channel) => {})
```

### consumer-channel:closed

```js
app.on('consumer-channel:closed', () => {})
```

### consumer-channel:error

```js
app.on('consumer-channel:error', (err) => {})
```

### publisher-channel:created

```js
app.on('publisher-channel:created', (channel) => {})
```

### publisher-channel:closed

```js
app.on('publisher-channel:closed', (channel) => {})
```

### publisher-channel:error

```js
app.on('publisher-channel:error', (err) => {})
```

### consumer:listen

```js
app.on('consumer:listen', (queueName, consumerTag) => {})
```

### consumer:error

```js
app.on('consumer:error', (err, context) => {})
```

# Bugs

This the initial release of the project. If you find any bugs or something goes wrong please let me know. [Open a issue](https://github.com/weyoss/slim-rabbit/issues) into github 
(including the case to reproduce the bug when possible).

# LICENSE

[MIT](https://github.com/weyoss/slim-rabbit/blob/master/LICENSE)