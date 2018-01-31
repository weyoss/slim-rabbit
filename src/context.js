'use strict';

const delegates = require('delegates');

class Context {
    /**
     *
     * @param {object} app
     * @param {object} message
     */
    constructor(app, message) {
        this.app = app;
        this.connection = app.connection;
        this.consumerChannel = app.consumerChannel;
        this.publisherChannel = app.publisherChannel;
        this.queueName = app.queueName;
        this.message = message;
        this.queueOpts = app.queueOpts;
        this.consumeOpts = app.consumeOpts;
        this.state = {};
        Object.assign(this, app.context);
    }

    /**
     *
     * @param {string} exchange
     * @param {string} routingKey
     * @param {(string|object|Buffer)} content
     * @param {object} options
     * @return {*}
     */
    async publish(exchange, routingKey, content, options = {}) {
        if (typeof exchange !== 'string') throw new TypeError('[exchange] must be a string.');
        if (typeof routingKey !== 'string') throw new TypeError('[routingKey] must be a string.');
        if (!(typeof content === 'string' || typeof content === 'object' || content instanceof Buffer)) {
            throw new TypeError('[content] must be a string, object or an instance of Buffer.');
        }
        if (typeof options !== 'object') throw new TypeError('[options] must be an object.');
        content = this.bufferFrom(content);
        return this.publisherChannel.publish(exchange, routingKey, content, options);
    }

    /**
     *
     * @param {string} queue
     * @param {(string|object|Buffer)} content
     * @param {object} options
     * @return {*}
     */
    async sendToQueue(queue, content, options = {}) {
        if (typeof queue !== 'string') throw new TypeError('[queue] must be a string');
        if (!(typeof content === 'string' || typeof content === 'object' || content instanceof Buffer)) {
            throw new TypeError('[content] must be a string, object or an instance of Buffer.');
        }
        if (typeof options !== 'object') throw new TypeError('[options] must be an object.');
        content = this.bufferFrom(content);
        return this.publisherChannel.sendToQueue(queue, content, options);
    }

    /**
     *
     * @param {*} err
     */
    onerror(err) {
        this.app.emit('consumer:error', err, this);
    }

    /**
     *
     * @param {*} data
     * @return {Buffer}
     */
    static bufferFrom(data) {
        if (Buffer.isBuffer(data)) return data;
        const string = (typeof data === 'object') ? JSON.stringify(data) : `${data}`;
        return Buffer.from(string);
    }
}

module.exports = Context;

const { prototype } = Context;

delegates(prototype, 'consumerChannel')
    .method('ack')
    .method('ackAll')
    .method('nack')
    .method('nackAll')
    .method('reject');

delegates(prototype, 'message')
    .getter('fields')
    .getter('properties')
    .access('content');

delegates(prototype, 'properties')
    .getter('headers');

delegates(prototype, 'fields')
    .getter('consumerTag')
    .getter('deliveryTag')
    .getter('redelivered')
    .getter('exchange')
    .getter('routingKey');
