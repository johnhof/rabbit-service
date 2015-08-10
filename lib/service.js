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


const SECOND         = 1000;
const MINUTE         = SECOND * 60;
const FIVE_MINUTES   = MINUTE * 5;
const rabbitCtx      = 'amqp://guest:guest@127.00.1';
const socketDefaults = {
  listen      : 'data',
  type        : 'SUB',
  options     : {
    routing : 'topic'
  }
}


////////////////////////////////////////////////////////////////////////////////
//
// Initial config
//
////////////////////////////////////////////////////////////////////////////////


module.exports = function (config) {
  config = config || {};

  var context = rabbit.createContext(config.context || rabbitCtx);


  //
  // defaults
  //
  var defaults = _.defaults(config.defaults || {}, socketDefaults);

  config.catch = config.catch || function *(err) { console.log(err.stack); }
  config.autoRestart = config.autoRestart || false;
  if (_.isFunction(config.autoRestart)) {
    config.autoRestart = {
      catch : config.autoRestart
    };
  }

  if (config.autoRestart && config.autoRestart.catch && !_.isGenerator(config.autoRestart.catch)) {
    console.log('! autoRestart.catch is not a generator. It will be ignored.');
    config.autoRestart.catch = function *() {};
  }

  //
  // on connection to rabbit
  //
  context.on('ready', function () {
    // reset the timeout
    config.autoRestart.timeout      = config.resautoRestarttart.startTimeout;
    config.autoRestart.attemptCount = 0;

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
          throw new Error('A controller directory is required to string based controllers');
        }

        config.controllers = /\/$/.test(config.controllers) ? config.controllers : config.controllers + '/'
        var ctrlSplit   = (socket.controller || '').split('.');
        var ctrlPath    = config.controllers + ctrlSplit[0];
        var ctrlHandler = ctrlSplit[1];

        try {
          controller = require(ctrlPath);

          if (ctrlHandler) {
            controller = controller[ctrlHandler];
          }
        } catch (e) {
          if (!~e.message.indexOf('Cannot find module \'' + ctrlPath + '\'')) {
            console.log(e.stack)
          }
          console.log('! Controller ' + socket.controller + ' not found verify path and handler: ' + ctrlPath + ' [' +  ctrlHandler+ ']')
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
      sockInstance.on(socket.listen, function(data){
        var app = {
          context    : context,
          channel    : socket.channel,
          controller : config.controllers ? socket.controller : 'anonymous_controller'
        };

        co(function *(){
          if (config.json) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              console.log(e.stack)
              throw new Error('Failed to parse message:\n' + data);
            }
          }
          if (config.middleware) {
            yield config.middleware(data, app, function *(_data, _app) {
              yield controller(_data || data, _app || app);
            });
          } else {
            yield controller(data, app);
          }

        }).catch(function (err) {
          co(function *() { yield config.catch.call(app, err); }).catch(config.catch);
        });
      });
    });
  });


  //
  // Error handling
  //

  context.on('error', function (error) {
    if (config.autoRestart) {
      config.autoRestart.startTimeout = config.autoRestart.startTimeout || SECOND;
      config.autoRestart.maxTimeout   = config.autoRestart.maxTimeout || FIVE_MINUTES;
      config.autoRestart.catch        = config.autoRestart.catch || function *(next) { return next; }

      co(function *() {
        if (~error.stack.indexOf('ECONNREFUSED')) {
          config.autoRestart.attemptCount = config.autoRestart.attemptCount || 0;
          config.autoRestart.timeout      = config.autoRestart.timeout || config.autoRestart.startTimeout;
          try {
            var cont    = yield config.autoRestart.catch.call(context, config, config.autoRestart.attemptCount, config.autoRestart.timeout);
          } catch (e) { console.log(e.stack); }
          var timeout = (config.autoRestart.timeout * 2) || config.autoRestart.startTimeout;

          if (cont !== false) {
            config.autoRestart.timeout
            config.autoRestart.attemptCount++;
            setTimeout(function () {
              context.close(); // stop dem leaks
              config.autoRestart.timeout = timeout > config.autoRestart.maxTimeout ? config.autoRestart.maxTimeout : timeout;
              context                    = module.exports(config);
            }, config.autoRestart.timeout);
          }
        } else {
          // config catch middleware
          try {
            var cont = yield config.catch.call(context, error);
          } catch (e) { console.log(e.stack); }
        }
      }).catch(function (err) { throw err; });
    }
  });
}
