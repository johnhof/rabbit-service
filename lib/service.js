var _      = require('lodash');
var genit  = require('genit').inject(_);
var co     = require('co');
var rabbit = require('rabbit.js');

// stash utilities and app settings
var app = {};


////////////////////////////////////////////////////////////////////////////////
//
// Defaults
//
////////////////////////////////////////////////////////////////////////////////


const SECOND = 1000;
const MINUTE = SECOND * 60;
const FIVE_MINUTES = MINUTE * 5;
const rabbitCtx = 'amqp://guest:guest@127.00.1';
const socketDefaults = {
  listen      : 'data',
  type        : 'SUB',
  options     : {
    routing : 'topic'
  }
};

var throwErr = function (err) {
  throw err;
};


////////////////////////////////////////////////////////////////////////////////
//
// Initial config
//
////////////////////////////////////////////////////////////////////////////////


module.exports = function (config, onConnect) {
  config = config || {};

  var context = rabbit.createContext(config.context || rabbitCtx);


  //
  // defaults
  //
  var defaults = _.defaults(config.defaults || {}, socketDefaults);

  config.catch = config.catch || function *(err) { console.log(err.stack); };

  config.reconnect = config.reconnect || false;
  if (_.isFunction(config.reconnect)) {
    config.reconnect = {
      catch : config.reconnect
    };
  }

  if (config.catch && !_.isGenerator(config.catch)) {
    console.warn('! catch is not a generator. It will be ignored.');
    config.catch = function *(err) { throw err; };
  }

  if (config.reconnect && config.reconnect.catch && !_.isGenerator(config.reconnect.catch)) {
    console.warn('! reconnect.catch is not a generator. It will be ignored.');
    config.reconnect.catch = function *() {};
  }

  config.onConnect = config.onConnect || onConnect || false;
  if (config.onConnect && !_.isGenerator(config.onConnect)) {
    console.warn('! Connection callback is not a generator. It will be ignored.');
    config.onConnect = false;
  }


  //
  // on connection to rabbit
  //
  context.on('ready', function () {
    // reset the timeout
    config.reconnect.timeout = config.reconnect.startDelay;
    config.reconnect.attemptCount = 0;

    // for every socket
    _.each(config.sockets, function (socket) {
      socket = _.defaults(socket, defaults);

      // set up the socket
      var sockInstance = context.socket(socket.type, socket.options);
      sockInstance.setEncoding('utf8');

      // find controller definition

      var controller = null;
      if (_.isString(socket.controller)) {
        if (!config.controllers) {
          throw new Error('A controller directory is required for string based controllers');
        }

        config.controllers = /\/$/.test(config.controllers) ? config.controllers : config.controllers + '/';
        var ctrlSplit = (socket.controller || '').split('.');
        var ctrlPath = config.controllers + ctrlSplit.shift();
        var ctrlHandlerChain = ctrlSplit;

        try {
          controller = require(ctrlPath); // get the controller file
          _.each(ctrlHandlerChain, function (propName) { controller = controller[propName]; }); // dig down thte property chain

        } catch (e) {
          if (!~e.message.indexOf('Cannot find module \'' + ctrlPath + '\'')) {
            console.error(e.stack);
          }

          console.warn('! Controller ' + socket.controller + ' not found verify path and handler: ' + ctrlPath + ' [' +  ctrlHandlerChain.join('.') + ']');
          return;
        }
      } else if (_.isFunction(socket.controller)) {
        controller = socket.controller;

      } else {
        throw new Error('Controller of type ' + (typeof socket.controller) + ' must be a Function or String');
      }

      // define the connection details
      if (socket.topic) {
        sockInstance.connect(socket.channel, socket.topic);
      } else {
        sockInstance.connect(socket.channel);
      }

      //
      // bind the socket to the event
      //
      sockInstance.on(socket.listen, function (data) {
        var socketReq = {
          context    : context,
          channel    : socket.channel,
          controller : config.controllers ? socket.controller : 'anonymous_controller',
          message    : data,
        };

        co(function *() {
          if (config.json) {
            try {
              socketReq.json = JSON.parse(data);
            } catch (e) {
              console.error(e.stack);
              throw new Error('Failed to parse message:\n' + data);
            }
          }

          if (config.middleware) {
            yield config.middleware.call(socketReq, function *() {
              yield controller.call(socketReq);
            });
          } else {
            yield controller.call(socketReq);
          }

        }).catch(function (err) {
          co(function *() { yield config.catch.call(app, err); }).catch(config.catch);
        });
      });
    });

    if (config.onConnect) { co(function *() { yield config.onConnect.call(context, config); }).catch(throwErr); }
  });


  //
  // Error handling
  //

  var errHandler = function (error) {
    if (config.reconnect) {
      config.reconnect.startDelay = config.reconnect.startDelay || SECOND;
      config.reconnect.maxDelay = config.reconnect.maxDelay || FIVE_MINUTES;
      config.reconnect.catch = config.reconnect.catch || function *() {};

      co(function *() {
        if (~error.stack.indexOf('ECONNREFUSED') || ~error.stack.indexOf('Unexpected close')) {
          config.reconnect.attemptCount = config.reconnect.attemptCount || 0;
          config.reconnect.timeout = config.reconnect.timeout || config.reconnect.startDelay;
          try {
            var cont = yield config.reconnect.catch.call(context, config, config.reconnect.attemptCount, config.reconnect.timeout, error);
          } catch (e) { console.error(e.stack); }

          var timeout = (config.reconnect.timeout * 2) || config.reconnect.startDelay;

          if (cont !== false) {
            config.reconnect.attemptCount++;
            setTimeout(function () {
              context.close(); // stop dem leaks
              config.reconnect.timeout = timeout > config.reconnect.maxDelay ? config.reconnect.maxDelay : timeout;
              context = module.exports(config);
            }, config.reconnect.timeout);
          }
        } else {
          // config catch middleware
          try {
            var cont = yield config.catch.call(context, error);
          } catch (e) { console.error(e.stack); }
        }
      }).catch(throwErr);
    }
  };

  context.on('close', errHandler);
  context.on('error', errHandler);
};
