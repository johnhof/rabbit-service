var _      = require('lodash');
var co     = require('co');
var rabbit = require('rabbit.js');

// stash utilities and app settings
var app = {};


////////////////////////////////////////////////////////////////////////////////
//
// Defaults
//
////////////////////////////////////////////////////////////////////////////////


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
  var defaults = _.defaults(config.defaults || {}, socketDefaults);

  //
  // on connection to rabbit
  //
  context.on('ready', function () {

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
          return console.log('! Contoller ' + socket.controller + ' not found verify path and handler: ' + ctrlPath + ' [' +  ctrlHandler+ ']')
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

        var coreFunction = co(function *(){
          if (config.json) {
            try {
              data = JSON.parse(data);
            } catch (e) {
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

        });

        var genericError = function (err) { console.log(err.stack); }

        if (config.error) {
          coreFunction.catch(function (err) {
            co(function *() {
              yield config.error(err, data, app);
            }).catch(genericError);
          });

        } else {
          coreFunction.catch(genericError)
        }
      });
    });
  });
}
