const ndnService = function($httpParamSerializer) {
  // Creates and returns interest based on input parameters. Interest name will
  // be '/<prefix>/<query>/<params>'.
  this.createInterest = function(
    prefix,
    query = 'noop',
    params = {},
    lifetime = 2000,
    mustBeFresh = true
  ) {
    const name = new Name(prefix + '/' + query);
    // Append the serialized parameters as a component in the format of
    // "?[key]=[value]&...".
    // The serialized parameters must be added to [name] by calling
    // Name.append(). If using new Name(prefix + query + paramString), ndnjs
    // will try to decode the part before '=' as decimal, which will be decoded
    // as NaN, causing an error.
    name.append('?' + $httpParamSerializer(params));
    const interest = new Interest(name);
    interest.setInterestLifetimeMilliseconds(lifetime);
    interest.setMustBeFresh(mustBeFresh);
    return interest;
  };

  // Sends [interest] through [face]. [retry] is the remaining retry times
  // after timeout.
  this.sendInterest = function(
    face,
    interest,
    handleData = () => {},
    handleTimeout = () => {},
    retry = 0
  ) {
    // On-data callback.
    const onData = function(interest, data) {
      // TODO: verify data integrity and decrypt.
      console.log(
        'Receive data for interest:',
        interest.name.toString(),
        '\nData content:',
        data.content.toString()
      );
      handleData(interest, data);
    };

    // On-timeout callback.
    const onTimeout = function(interest) {
      console.log('Timeout interest:', interest.name.toString());
      handleTimeout(interest);
      // If [retry] is larger than 0, double interest lifetime and retry.
      if (retry > 0) {
        console.log(retry.toString(), 'retry times left. Retrying...');
        interest.setInterestLifetimeMilliseconds(
          2 * interest.getInterestLifetimeMilliseconds()
        );
        this.sendInterest(face, interest, handleData, handleTimeout, retry - 1);
      }
    }.bind(this);

    // Express interest.
    face.expressInterest(interest, onData, onTimeout);
    console.log('Send interest:', interest.name.toString());
  };

  // Registers [prefix] and returns the registered prefix ID.
  this.registerPrefix = function(
    face,
    prefix,
    handleInterest = () => {},
    handleRegisterFailed = () => {},
    handleRegisterSuccess = () => {}
  ) {
    // On-interest callback.
    const onInterest = function(
      prefix,
      interest,
      face,
      interestFilterId,
      filter
    ) {
      console.log('Receive interest:', interest.name.toString());
      // TODO: verify interest.
      // Get response by calling handleInterest().
      const response = handleInterest(interest);
      // If response is null, do not send any response.
      if (response === null) return;
      // Set the data name to the same as the interest. Otherwise, the
      // response data name will not match the interest name, which will
      // result in interest timeout.
      response.setName(interest.name);
      // Sign and send response.
      face.commandKeyChain.sign(
        response,
        face.commandCertificateName,
        function() {
          try {
            face.putData(response);
            console.log(
              'Send data of name:',
              response.name.toString(),
              '\nData content:',
              response.getContent()
            );
          } catch (error) {
            console.log('Send data error!', error.toString());
          }
        }
      );
    };

    // On-register-failed callback.
    const onRegisterFailed = function(prefix) {
      console.log('Register prefix failed:', prefix.toUri());
      handleRegisterFailed(prefix);
    };

    // On-register-success callback.
    const onRegisterSuccess = function(prefix, registeredPrefixId) {
      console.log(
        'Register prefix succeeded:',
        prefix.toUri(),
        'with ID',
        registeredPrefixId
      );
      handleRegisterSuccess(prefix, registeredPrefixId);
    };

    // Register prefix.
    const registeredPrefixId = face.registerPrefix(
      new Name(prefix),
      onInterest,
      onRegisterFailed,
      onRegisterSuccess
    );
    return registeredPrefixId;
  };

  // Remove a registered prefix with ID [registeredPrefixId] from [face].
  this.removeRegisteredPrefix = function(face, registeredPrefixId) {
    face.removeRegisteredPrefix(registeredPrefixId);
    console.log('Remove registered prefix with ID', registeredPrefixId);
  };
};

// Register service.
ndnWhiteboardApp.service('ndn', ndnService);
