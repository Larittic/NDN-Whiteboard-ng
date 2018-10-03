var utilService = angular.module('utilService', [])
.service('util', function () {
  // Generates a random ID by appending a random alphanumeric string of given
  // length to original ID.
  this.getRandomId = function (originalId, randSuffixLength) {
    const DICT = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    if (randSuffixLength <= 0) return originalId;
    let randomId = originalId + '_';
    for (let i = 0; i < randSuffixLength; i++) {
      randomId += DICT[Math.floor(Math.random() * DICT.length)];
    }
    return randomId;
  };

  // Gets parameter by name from URL string.
  this.getParameterByName = function (name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  };

  // Gets query string and parameter string from an interest.
  this.getQueryAndParams = function (interest) {
    let queryString = decodeURIComponent(interest.getName().getSubName(-1).toUri());
    queryString = queryString.substring(1, queryString.length);
    let query = queryString;
    let params = '';
    if (queryString.indexOf('?') !== -1) {
        const splited = queryString.split('?');
        if (splited.length > 2) return {};
        query = splited[0];
        params = '?' + splited[1];
    }
    return {
        query: query,
        params: params
    };
  };
});
