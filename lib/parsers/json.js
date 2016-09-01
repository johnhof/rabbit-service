'use strict';

module.exports = (options) => {
  return function jsonParser (next) {
    return new Promise((resolve, reject) => {
      this.message;
      try {
        this.json = JSON.parse(this.message);
      } catch (e) {
        let error = Error('Failed to parse message');
        reject(error);
      }
      next().then(resolve);
    });
  }
}
