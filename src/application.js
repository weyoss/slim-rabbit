'use strict';

const Emitter = require('events');
const amqplib = require('amqplib');
const compose = require('koa-compose');
const Context = require('./context');


class Application extends Emitter {
    /**
     *
     * @param {string} queueName
     * @param {object} queueOpts
     * @param {object} consumeOpts
     */
    constructor(queueName, queueOpts = {}, consumeOpts = {}) {
        super();
        if (typeof queueName !== 'string') throw new TypeError('[queueName] must be a string.');
        if (typeof queueOpts !== 'object') throw new TypeError('[queueOpts] must be an object.');
        if (typeof consumeOpts !== 'object') throw new TypeError('[consumeOpts] must be an object.');
        this.queueName = queueName;
        this.queueOpts = queueOpts;
        this.consumeOpts = consumeOpts;
        this.context = {};
        this.middlewares = [];
    }

    /**
     *
     * @param {number} count
     * @param {boolean} global
     */
    prefetch(count, global = false) {
        if (typeof count !== 'number') throw new TypeError('[count] must be a number.');
        if (typeof count !== 'boolean') throw new TypeError('[global] must be a boolean.');
        this.prefetchOpts = {
            count,
            global,
        };
    }

    /**
     *
     * @param middlewares
     * @return {Application}
     */
    use(...middlewares) {
        for (const fn of middlewares) {
            if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!');
        }
        this.middlewares = this.middlewares.concat(middlewares);
        return this;
    }

    /**
     *
     * @param {string} url
     * @param {object} socketOpts
     * @return {Promise.<void>}
     */
    async connect(url, socketOpts = {}) {
        if (!this.middlewares.length) throw new Error('At least one queue middleware is required.');
        if (!this.listeners('consumer:error').length) throw new Error('An error handler is required.');
        if (typeof url !== 'string') throw new TypeError('[url] must be a string.');
        if (typeof socketOpts !== 'object') throw new TypeError('[socketOpts] must be an object.');

        /**
         *
         * @return {function(*=)}
         */
        const messageHandler = () => {
            const fn = compose(this.middlewares);
            return async (message) => {
                const context = new Context(this, message);
                try {
                    await fn(context);
                } catch (err) {
                    context.onerror(err);
                }
            };
        };

        /**
         *
         * @return {Promise.<void>}
         */
        const consume = async () => {
            const handler = messageHandler();
            await this.consumerChannel.assertQueue(this.queueName, this.queueOpts);
            return this.consumerChannel.consume(this.queueName, handler, this.consumeOpts);
        };

        try {
            // Create application connection
            this.connection = await this.createConnection(url, socketOpts);

            // Create consumer channel
            this.consumerChannel = await this.createChannel(this.connection, 'consumer-channel');
            if (this.prefetchOpts) this.consumerChannel.prefetch(this.prefetchOpts.count, this.prefetchOpts.global);

            // Create publisher channel
            this.publisherChannel = await this.createChannel(this.connection, 'publisher-channel');

            // Consume!
            this.consumerTag = await consume();
            this.emit('consumer:listen', this.queueName, this.consumerTag);
        } catch (err) {
            this.close().catch((closeError) => {
                throw err;
            });
        }
    }

    /**
     *
     * @return {Promise.<void>}
     */
    async close() {
        if (this.consumerChannel) await this.consumerChannel.close();
        delete this.consumerChannel;

        if (this.publisherChannel) await this.publisherChannel.close();
        delete this.publisherChannel;

        if (this.connection) await this.connection.close();
        delete this.connection;
    }

    /**
     *
     * @param {string} url
     * @param {object} socketOpts
     * @return {Promise.<*>}
     */
    async createConnection(url, socketOpts) {
        const connection = await amqplib.connect(url, socketOpts);
        this.emit('connection:created', connection);
        connection.on('error', (err) => {
            if (err.message !== 'Connection closing') {
                this.emit('connection:error', err);
            }
        });
        connection.on('close', () => {
            this.emit('connection:close');
        });
        return connection;
    }

    /**
     *
     * @param {object} connection
     * @param {string} key
     * @return {Promise.<*>}
     */
    async createChannel(connection, key) {
        const channel = await connection.createChannel();
        this.emit(`${key}:created`, channel);
        channel.on('error', (err) => {
            this.emit(`${key}:error`, err);
        });
        channel.on('close', () => {
            this.emit(`${key}:close`);
        });
        return channel;
    }
}

module.exports = Application;
