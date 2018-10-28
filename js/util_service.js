const utilService = function() {
  // Deep copies an object.
  this.deepcopy = function(object) {
    return JSON.parse(JSON.stringify(object));
  };

  // Generates a random alphanumeric string of input length.
  this.getRandomString = function(length) {
    if (length <= 0) return '';
    const DICT =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let randomString = '';
    for (let i = 0; i < length; i++) {
      randomString += DICT[Math.floor(Math.random() * DICT.length)];
    }
    return randomString;
  };

  // Generates a random ID by appending a random alphanumeric string of input
  // length to original ID.
  this.getRandomId = function(originalId, randSuffixLength) {
    originalId = originalId.replace(' ', '_');
    if (randSuffixLength <= 0) return originalId;
    let randomId = originalId + '-' + this.getRandomString(randSuffixLength);
    return randomId.toUpperCase();
  };

  // Gets parameter by name from URL string. Returns null if no parameter
  // matches the [name].
  this.getParameterByName = function(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  };

  // TODO: delete if unused.
  // Gets query string and parameter string from an interest.
  this.getQueryAndParams = function(interest) {
    let queryString = decodeURIComponent(
      interest.name.getSubName(-3).toUri()
    );
    queryString = queryString.substring(1, queryString.length);
    let query = queryString;
    let params = '';
    if (queryString.indexOf('?') !== -1) {
      const splited = queryString.split('?');
      if (splited.length > 2) throw new Error('Invalid interest name.');
      query = splited[0];
      params = '?' + splited[1];
    }
    return {
      query: query,
      params: params
    };
  };

  // Gets the escaped string of the [index] th component in name.
  this.getComponentString = function(name, index) {
    index = ((index % name.size()) + name.size()) % name.size();
    return decodeURIComponent(name.get(index).toEscapedString());
  };

  // TODO: delete if unused.
  // Gets the uri string of subname containing [numComponent] components starting
  // from the [start] th component (inclusive) in [name].
  this.getSubNameUri = function(name, start, numComponent) {
    start = ((start % name.size()) + name.size()) % name.size();
    if (!numComponent) numComponent = name.size() - start;
    if (numComponent <= 0 || start + numComponent > name.size()) {
      return '';
    }
    return name.getSubName(start, numComponent).toUri();
  };

  // Serializes a public key.
  this.serializePublicKey = function(publicKey) {
    const pub = publicKey.get();
    return sjcl.codec.base64.fromBits(pub.x.concat(pub.y));
  };

  // Unserializes a public key.
  this.unserializePublicKey = function(publicKeyString) {
    return new sjcl.ecc.ecdsa.publicKey(
      sjcl.ecc.curves.c256,
      sjcl.codec.base64.toBits(publicKeyString)
    );
  };

  // Copies [text] to clipboard.
  this.copyToClipboard = function(text) {
    console.log('Try to copy:', text);
    const aux = document.createElement('input');
    aux.setAttribute('value', text);
    document.body.appendChild(aux);
    aux.select();
    try {
      const successful = document.execCommand('copy');
      console.log(
        'Copying text command was',
        successful ? 'successful.' : 'unsuccessful.'
      );
    } catch (error) {
      console.log('Unable to copy text to clipboard');
    } finally {
      document.body.removeChild(aux);
    }
  };
};

// Register service.
ndnWhiteboardApp.service('util', utilService);
