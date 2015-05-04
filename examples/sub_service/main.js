var spawn    = require('child_process').spawn;

console.log('Starting koa...');
var koaProc = spawn('node', [ '--harmony','./koa_service.js']);
koaProc.stdout.pipe(process.stdout);
koaProc.stderr.pipe(process.stderr);

console.log('Starting rabbit...');
var rabbitProc = spawn('node', [ '--harmony','./rabbit_service.js']);
rabbitProc.stdout.pipe(process.stdout);
rabbitProc.stderr.pipe(process.stderr);
