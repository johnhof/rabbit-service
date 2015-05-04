module.exports = function *(json, app) {
  console.log('from another_test:')
  app.log(json);
}
