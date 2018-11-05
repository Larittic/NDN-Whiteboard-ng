const ndnService = function($exceptionHandler) {
  // If a data's content size exceeds this threshold, it will be segmented.
  this.maxDataContentSize = Face.getMaxNdnPacketSize() / 2;

  // Map from segmented data name uri to the corresponding data objects.
  // e.g.,
  //  key = 'ndn/abc';
  //  value = {
  //    segmentNum: Data(segmented: true, segmentNum: 3),
  //    segmentData: [Data('a'), Data('b'), Data('c')]
  //  }
  this.segmentedDataMap = {};

  // Map from registered prefix id to prefix name.
  this.prefixIdToNameMap = {};

  // Sends [interest] through [face]. [retry] is the remaining retry times
  // after timeout.
  this.sendInterest = function(
    face,
    validator,
    interest,
    handleData = () => {},
    handleTimeout = () => {},
    retry = 0
  ) {
    // On-data callback.
    const onData = function(interest, data) {
      console.log(
        'Receive data for interest:',
        interest.name.toUri(),
        '\nData content:',
        data.content.toString()
      );
      validator.validate(
        data,
        /*successCallback=*/ function(data) {
          // If the data name's last component is 'segmented', it means that this
          // data only contains the numebr of segments. Send interests for every
          // segment respectively and concatenate them to form the complete data
          // before calling handleData.
          if (data.name.get(-1).toEscapedString() === 'segmented') {
            const segmentNum = JSON.parse(data.content).segmentNum;
            fetchSegmentedData(
              face,
              validator,
              interest,
              segmentNum,
              handleData,
              handleTimeout
            );
          } else {
            handleData(interest, data);
          }
        },
        /*failureCallback=*/ function(data, reason) {
          console.log(
            'Validation of data',
            data.name.toUri(),
            'failed for reason:',
            reason
          );
        }
      );
    };

    // On-timeout callback.
    const onTimeout = function(interest) {
      console.log('Timeout interest:', interest.name.toUri());
      handleTimeout(interest);
      // If [retry] is larger than 0, double interest lifetime and retry.
      if (retry > 0) {
        console.log(retry.toString(), 'retry times left. Retrying...');
        interest.setInterestLifetimeMilliseconds(
          2 * interest.getInterestLifetimeMilliseconds()
        );
        this.sendInterest(
          face,
          validator,
          interest,
          handleData,
          handleTimeout,
          retry - 1
        );
      }
    }.bind(this);

    // Express interest.
    face.expressInterest(interest, onData, onTimeout);
    console.log('Send interest:', interest.name.toUri());
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
      console.log('Receive interest:', interest.name.toUri());
      // Get response by calling handleInterest().
      let response = handleInterest(interest);
      // If response is null, do not send any response.
      if (response === null) return;

      // Segment data if data content size exceeds max data content size.
      if (response.content.byteLength > this.maxDataContentSize) {
        response = segmentData(response, interest.name, face);
      }

      // Sign and send response.
      face.commandKeyChain.sign(
        response,
        face.commandCertificateName,
        function() {
          try {
            face.putData(response);
            console.log(
              'Send data of name:',
              response.name.toUri(),
              '\nData content:',
              response.getContent()
            );
          } catch (error) {
            $exceptionHandler(error);
          }
        }
      );
    }.bind(this);

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

    const prefixName = new Name(prefix);
    // Register prefix.
    const registeredPrefixId = face.registerPrefix(
      prefixName,
      onInterest,
      onRegisterFailed,
      onRegisterSuccess
    );
    // Set the registered prefix id to name map.
    this.prefixIdToNameMap[registeredPrefixId] = prefixName;
    return registeredPrefixId;
  };

  // Removes a registered prefix with ID [registeredPrefixId] from [face].
  this.removeRegisteredPrefix = function(face, registeredPrefixId) {
    const registeredPrefixName = this.prefixIdToNameMap[registeredPrefixId];
    const prefixIdsToDelete = [];
    // Remove all registered prefixes that have nams of which this prefix name
    // is a prefix of.
    for (const prefixId in this.prefixIdToNameMap) {
      const prefixName = this.prefixIdToNameMap[prefixId];
      if (registeredPrefixName.isPrefixOf(prefixName)) {
        face.removeRegisteredPrefix(prefixId);
        console.log('Remove registered prefix of ID', prefixId);
        delete this.segmentedDataMap[prefixName.toUri()];
        prefixIdsToDelete.push(prefixId);
      }
    }
    // Delete all the prefixId entries in [this.prefixIdToNameMap].
    for (const prefixId of prefixIdsToDelete) {
      delete this.prefixIdToNameMap[prefixId];
    }
  };

  // Fetches segmented data.
  const fetchSegmentedData = function(
    face,
    validator,
    originalInterest,
    segmentNum,
    finalHandleData,
    finalHandleTimeout
  ) {
    // The array to collect segmented data content. It will be merged to a
    // complete data content before being passed into [finalHandleData].
    let segmentedDataContent = new Array(segmentNum);
    // The number of received segments.
    let numSegmentsReceived = 0;
    // Ensures [finalHandleTimeout] is only called once.
    let isFinalHandleTimeoutCalled = false;
    for (let i = 0; i < segmentNum; i++) {
      const interest = new Interest(originalInterest);
      interest.name.append(i.toString());
      this.sendInterest(
        face,
        validator,
        interest,
        (function() {
          const j = i;
          return function(interest, data) {
            segmentedDataContent[j] = data.content;
            numSegmentsReceived++;
            if (numSegmentsReceived === segmentNum) {
              // Merge the segmented data content to reconstruct complete data.
              // Use the metaInfo of any segment. They should be the same.
              const completeData = new Data(
                new Name(originalInterest.name),
                data.getMetaInfo(),
                Buffer.concat(segmentedDataContent)
              );
              finalHandleData(originalInterest, completeData);
            }
          };
        })(),
        (function() {
          return function(interest) {
            if (!isFinalHandleTimeoutCalled) {
              isFinalHandleTimeoutCalled = true;
              finalHandleTimeout(originalInterest);
            }
          };
        })()
      );
    }
  }.bind(this);

  // Segments data. Store the segmented data in [this.segementedDataMap] and
  // registers prefix for each piece of data. Returns the a data containing the
  // number of segments.
  const segmentData = function(data, name, face) {
    const segmentNumAndData = {
      segmentNum: 0,
      segmentData: []
    };
    // Segment data.
    let i = 0;
    for (
      let pos = 0;
      pos < data.content.byteLength;
      pos += this.maxDataContentSize
    ) {
      const segmentName = new Name(name);
      segmentNumAndData.segmentData.push(
        new Data(
          segmentName.append(i.toString()),
          data.getMetaInfo(),
          data.content.slice(pos, pos + this.maxDataContentSize)
        )
      );
      i++;
    }
    // Set segment number to a data object containing [i].
    const segmentNumName = new Name(name);
    segmentNumAndData.segmentNum = new Data(
      segmentNumName.append('segmented'),
      data.getMetaInfo(),
      JSON.stringify({
        segmented: true,
        segmentNum: i
      })
    );
    this.segmentedDataMap[name.toUri()] = segmentNumAndData;
    // Register prefix for the segmented data.
    this.registerPrefix(
      face,
      name,
      function(interest) {
        if (interest.name.size() === name.size()) {
          // If the interest name does not end with a segment number, return the
          // segment number data.
          return this.segmentedDataMap[name.toUri()].segmentNum;
        } else if (interest.name.size() === name.size() + 1) {
          // If the interest name ends with a segment number, return that segment.
          const uri = interest.name
            .getSubName(0, interest.name.size() - 1)
            .toUri();
          const index = parseInt(interest.name.get(-1).toEscapedString());
          if (
            isNaN(index) ||
            index < 0 ||
            index >= this.segmentedDataMap[uri].segmentData.length
          ) {
            return null;
          }
          return this.segmentedDataMap[uri].segmentData[index];
        } else {
          return null;
        }
      }.bind(this)
    );
    return segmentNumAndData.segmentNum;
  }.bind(this);
};

// Register service.
ndnWhiteboardApp.service('ndn', ndnService);
