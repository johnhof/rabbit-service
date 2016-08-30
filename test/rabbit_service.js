'use strict';

let mocha = require('mocha');
let expect = require('chai').expect;
let deepEqual = require('deep-equal')

let RabbitService = require('../lib/service');

const DEFAULTS = require('../lib/service/defaults');

describe('RabbitService', () => {
  describe('.constructor', () => {
    it('should apply default values', function *() {
      let rs = new RabbitService();
      expect(deepEqual(rs.config, DEFUALTS));
    });
    it('should allow overwriting of default values', function *() {
      let overwrite = { context : { host: 'test.com' } };
      let rs = new RabbitService();
      expect(rs.config.context.port).to.equal(DEFAULTS.config.context.port);
      expect(rs.config.context.host).to.equal(overwrite.config.context.host);
    });
  });
  describe('.setContext', () => {
    let ctx = {
      port: '9999',
      host: '127.0.0.2',
      username: 'test',
      password: 'tester',
    };
    let url = 'amqp://' + ctx.username + ':' + ctx.password + '@' + ctx.host + ':' + ctx.port;

    it('should take a string host and listen on it', function *() {
      let rs = new RabbitService();
      rs.setContext(url);
      expect(rs.config.context.host).to.equal(ctx.host);
      expect(rs.config.context.port).to.equal(ctx.port);
      expect(rs.config.context.username).to.equal(ctx.username);
      expect(rs.config.context.password).to.equal(ctx.password);
      expect(rs.config.context.url).to.equal(url);
    });
    it('should take an object context and listen on it', function *() {
      let rs = new RabbitService();
      rs.setContext(ctx);
      expect(rs.config.context.host).to.equal(ctx.host);
      expect(rs.config.context.port).to.equal(ctx.port);
      expect(rs.config.context.username).to.equal(ctx.username);
      expect(rs.config.context.password).to.equal(ctx.password);
      expect(rs.config.context.url).to.equal(url);
    });
  });
  // describe('.listen', () => {
  //   it('should take no parameters and listen on defaults', function *() {
  //     let rs = new RabbitService();
  //     expect(deepEqual(rs.config, DEFUALTS));
  //   });
  //   it('should take a string host and listen on it', function *() {
  //     let host =
  //     let rs = new RabbitService();
  //     expect(deepEqual(rs.config, DEFUALTS));
  //   });
  //   it('should take an object context and listen on it', function *() {
  //     let rs = new RabbitService();
  //     expect(deepEqual(rs.config, DEFUALTS));
  //   });
  // });
});
