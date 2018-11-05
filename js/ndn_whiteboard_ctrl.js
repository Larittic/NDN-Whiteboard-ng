const ndnWhiteboardCtrl = function(
  $scope,
  $window,
  $exceptionHandler,
  $httpParamSerializer,
  /* util service */ util,
  /* ndn service */ ndn,
  /* Group factory */ Group,
  /* Canvas factory */ Canvas,
  /* config constant */ config
) {
  // DEBUG
  $scope.logGroup = function() {
    console.log($scope.group);
  };
  // DEBUG
  $scope.logCanvas = function() {
    console.log($scope.canvas);
  };

  // Load config constants into [$scope] so that they can be used in html.
  $scope.STROKE_STYLE_OPTIONS = config.STROKE_STYLE_OPTIONS;
  $scope.LINE_WIDTH_OPTIONS = config.LINE_WIDTH_OPTIONS;

  // Show setting and hide whiteboard in the beginning.
  $scope.showSetting = true;
  $scope.showWhiteboard = false;
  $scope.disableSubmitSetting = false;

  // $scope methods.

  // Uses default NFD host.
  $scope.useDefaultNfdHost = function() {
    $scope.nfdHost = config.DEFAULT_NFD_HOST;
  };

  // Submits the NFD host and username settings, initializes the whiteboard.
  $scope.submitSetting = function() {
    // Disable submit setting button.
    $scope.disableSubmitSetting = true;
    // Get user ID by randomizing based on input username.
    $scope.userId = util.getRandomId($scope.username, 6);
    // Create asymmetric key pair used for signing.
    $scope.signingKeyPair = sjcl.ecc.ecdsa.generateKeys(256);
    // Initialize canvas.
    $scope.canvas = new Canvas(document.getElementById('canvas'));
    // Num of last canvas update from user drawing (not from other group
    // members). It is used to check if there is a fresh canvas update.
    $scope.canvasLastUpdateNum = -1;
    // Create NDN face.
    $scope.face = new Face({ host: $scope.nfdHost });
    // Create validator to validate data.
    $scope.validator = new Validator(new ValidationPolicyAcceptAll());
    // Create NDN key chain.
    $scope.keyChain = new KeyChain('pib-memory:', 'tpm-memory:');
    // Create default identity and set it as command signing info.
    $scope.keyChain.createIdentityV2(
      /*identityName=*/ new Name('defaultIdentity'),
      /*params=*/ KeyChain.getDefaultKeyParams(),
      /*onComplete=*/ function() {
        $scope.$apply(function() {
          $scope.face.setCommandSigningInfo(
            $scope.keyChain,
            $scope.keyChain.getDefaultCertificateName()
          );
          // Create a new group as manager.
          createGroup();
          // Hide setting and show whiteboard.
          $scope.showSetting = false;
          $scope.showWhiteboard = true;
        });
      },
      /*onError=*/ function(error) {
        $exceptionHandler(error);
      }
    );
  };

  // Leaves the current group and creates a new group automatically.
  $scope.leaveGroup = function() {
    leaveGroup();
    createGroup();
  };

  // Copies group link to clipboard.
  $scope.shareLink = function() {
    util.copyToClipboard($scope.group.getGroupLink());
  };

  // Tries to join an existing group through group link.
  $scope.joinGroup = function() {
    joinGroup();
  };

  // Canvas mousedown handler.
  $scope.canvasMousedown = function(event) {
    $scope.canvas.mousedown(event);
  };

  // Canvas mouseup handler.
  $scope.canvasMouseup = function(event) {
    $scope.canvas.mouseup(event);
    const update = $scope.canvas.getLastContentUpdate();
    // If this update is null or not fresh, return immediately.
    if (!update || update.num <= $scope.canvasLastUpdateNum) return;
    $scope.canvasLastUpdateNum = update.num;
    // Save latest whiteboard update and notify group members of
    // whiteboard update.
    saveWhiteboardUpdate($scope.userId, update);
    notifyWhiteboardUpdate(update.num);
  };

  // Canvas mouseleave handler.
  $scope.canvasMouseleave = function(event) {
    $scope.canvas.mouseleave(event);
    const update = $scope.canvas.getLastContentUpdate();
    // If this update is null or not fresh, return immediately.
    if (!update || update.num <= $scope.canvasLastUpdateNum) return;
    $scope.canvasLastUpdateNum = update.num;
    // Save latest whiteboard update and notify group members of
    // whiteboard update.
    saveWhiteboardUpdate($scope.userId, update);
    notifyWhiteboardUpdate(update.num);
  };

  // Canvas mousemove handler.
  $scope.canvasMousemove = function(event) {
    $scope.canvas.mousemove(event);
  };

  // $window methods.

  // Pop up warning message on page beforeunload event if user is within group.
  $window.onbeforeunload = function(event) {
    if (!$scope.group) return;
    // Cancel the event as stated by the standard.
    event.preventDefault();
    // In some browsers, the return value of the event is displayed in this
    // dialog. Starting with Firefox 44, Chrome 51, Opera 38 and Safari 9.1, a
    // generic string not under the control of the webpage will be shown
    // instead of the returned string.
    event.returnValue = 'Leave group?';
  };

  // Leave group on page unload event if user is within group.
  $window.onunload = function() {
    if (!$scope.group) return;
    leaveGroup();
  };

  // Private (local) methods.

  // Creates a new group as the initial manager and registers member prefix.
  const createGroup = function() {
    $scope.group = new Group(
      /*groupId=*/ util.getRandomId('Group', 6),
      /*uriPrefix=*/ config.URI_PREFIX,
      /*manager=*/ $scope.userId,
      /*managerPublicKey=*/ $scope.signingKeyPair.pub
    );
    // Try to register member prefix.
    try {
      $scope.memeberPrefixId = registerMemberPrefix();
    } catch (error) {
      $exceptionHandler(error);
    }
  };

  // Tries to join an existing group through group link.
  const joinGroup = function() {
    const groupLink = $scope.groupLink;
    if (groupLink === $scope.group.getGroupLink()) {
      console.log('Already in group. Group link:', groupLink);
      return;
    }

    // TODO: disable join group button before getting the join result.

    // Parse group link.
    const parsedGroupLink = Group.parseGroupLink(groupLink);

    // TODO: throw error if parsing failed.

    // Callback to handle received data. Note that all callbacks that manipulate
    // $scope data should be wrapped in $scope.$apply() for them to be updated
    // timely.
    const handleData = function(interest, data) {
      $scope.$apply(function() {
        try {
          const dataContent = JSON.parse(
            decryptAndVerifyData(
              data.content,
              parsedGroupLink.password,
              parsedGroupLink.managerPublicKey
            )
          );
          if (dataContent.accept) {
            leaveGroup();
            $scope.group.setGroupView(dataContent.groupView);
            $scope.group.setAllWhiteboardUpdates(dataContent.whiteboardUpdates);
            // Set canvas content.
            $scope.canvas.setContentUpdates(
              Object.values(dataContent.whiteboardUpdates)
            );
            // Register member prefix.
            $scope.memeberPrefixId = registerMemberPrefix();
          } else {
            console.log('Join group request rejected. Group link:', groupLink);
          }
        } catch (error) {
          $exceptionHandler(error);
        }
      });
    };

    // Callback to handle timeout.
    const handleTimeout = function(interest) {
      console.log('Join group request timeout. Group link:', groupLink);
    };

    const interest = createInterest(
      /*prefix=*/ parsedGroupLink.prefix,
      /*query=*/ 'request_join',
      /*params=*/ {
        id: $scope.userId,
        publicKey: util.serializePublicKey($scope.signingKeyPair.pub),
        time: new Date().getTime()
      },
      /*mustBeFresh=*/ true,
      /*lifetime=*/ 2000,
      /*signBeforeReturn=*/ true,
      /*nonce=*/ parsedGroupLink.nonce
    );
    ndn.sendInterest(
      $scope.face,
      $scope.validator,
      interest,
      handleData,
      handleTimeout
    );
  };

  // Leaves the current group by removing registered prefixes and notifying the
  // manager. If the user is group manager, instead of notifying the manger, it
  // will send manager_leave interest to another member if there is any. The
  // member become the new manager and notify the group.
  //
  // * Note that, when the manager leaves the group, group link also changes.
  const leaveGroup = function() {
    if (!$scope.group) return;
    // Remove registered prefix.
    if ($scope.memeberPrefixId) {
      ndn.removeRegisteredPrefix($scope.face, $scope.memeberPrefixId);
    }

    // If the user is group manager, send manager_leave interest to another
    // member who will become the new manager and notify the group. Otherwise,
    // send member_leave to group manager.
    let interest = null;
    if ($scope.userId === $scope.group.manager) {
      const newManager = $scope.group.pickNewManager();
      if (newManager) {
        interest = createInterest(
          /*prefix=*/ $scope.group.getMemberPrefix(newManager),
          /*query=*/ 'manager_leave',
          /*params=*/ {
            id: $scope.userId,
            time: new Date().getTime()
          }
        );
      }
    } else {
      interest = createInterest(
        /*prefix=*/ $scope.group.getManagerPrefix(),
        /*query=*/ 'member_leave',
        /*params=*/ {
          id: $scope.userId,
          time: new Date().getTime()
        }
      );
    }
    if (interest) {
      ndn.sendInterest($scope.face, $scope.validator, interest);
    }

    // Clear canvas content and reset last update number.
    $scope.canvas.reset();
    $scope.canvasLastUpdateNum = -1;
    // Reset as empty group.
    $scope.group = new Group();
  };

  // Registers member prefix. Returns registered prefix ID if succeeds.
  const registerMemberPrefix = function() {
    // Callback to handle interest.
    // Interest format: '/<prefix>/<query>/<params>/<signer>/<signature>'.
    const handleInterest = function(interest) {
      return $scope.$apply(function() {
        try {
          const query = util.getComponentString(interest.name, -4);
          const params = util.getComponentString(interest.name, -3);
          // Call corresponding handler if exists.
          if (query in interestHandler) {
            return interestHandler[query](interest, params);
          }
          return null;
        } catch (error) {
          $exceptionHandler(error);
          return null;
        }
      });
    };
    // Return registered prefix ID.
    return ndn.registerPrefix(
      $scope.face,
      $scope.group.getMemberPrefix($scope.userId),
      handleInterest
    );
  };

  // Interest handlers classified by query strings.
  const interestHandler = {
    // Handler for 'request_join' interest. Only manager will call it.
    request_join: function(receivedInterest, params) {
      if ($scope.userId !== $scope.group.manager) return null;
      // Verify interest.
      const publicKey = util.unserializePublicKey(
        util.getParameterByName('publicKey', params)
      );
      verifyInterest(receivedInterest, publicKey);
      const requester = util.getParameterByName('id', params);
      const requesterPublicKey = util.unserializePublicKey(
        util.getParameterByName('publicKey', params)
      );
      // Add requester to group and notify members of group update.
      $scope.group.addMember(requester, requesterPublicKey);
      notifyGroupUpdate();
      // Reponse includes accept decision and all current group data.
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData(
          JSON.stringify({
            accept: true,
            groupView: $scope.group.getGroupView(),
            whiteboardUpdates: $scope.group.getAllWhiteboardUpdates()
          })
        )
      );
    },

    // Handler for 'member_leave' interest. Only manager will call it.
    member_leave: function(receivedInterest, params) {
      if ($scope.userId !== $scope.group.manager) return null;
      // Verify interest.
      const signer = util.getComponentString(receivedInterest.name, -2);
      const publicKey = $scope.group.publicKey[signer];
      verifyInterest(receivedInterest, publicKey);
      const leaver = util.getParameterByName('id', params);
      // Remove leaver from group and notify members of group update.
      $scope.group.removeMember(leaver);
      notifyGroupUpdate();
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData('ACK')
      );
    },

    // Handler for 'manager_leavel' interest.
    manager_leave: function(receivedInterest, params) {
      // Verify interest.
      const signer = util.getComponentString(receivedInterest.name, -2);
      const publicKey = $scope.group.publicKey[signer];
      verifyInterest(receivedInterest, publicKey);
      const previousManager = util.getParameterByName('id', params);
      // Remove the previous manager from group and take over the manager role.
      $scope.group.removeMember(previousManager);
      $scope.group.manager = $scope.userId;
      // Notify members of group update.
      notifyGroupUpdate();
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData('ACK')
      );
    },

    // Handler for 'notify_group_update' interest.
    notify_group_update: function(receivedInterest, params) {
      // Verify interest.
      const signer = util.getComponentString(receivedInterest.name, -2);
      const publicKey = $scope.group.publicKey[signer];
      verifyInterest(receivedInterest, publicKey);
      const senderId = util.getParameterByName('id', params);
      // Callback to handle received data.
      const handleData = function(interest, data) {
        $scope.$apply(function() {
          try {
            $scope.group.setGroupView(
              JSON.parse(decryptAndVerifyData(data.content))
            );
          } catch (error) {
            $exceptionHandler(error);
          }
        });
      };
      // Send interest to retrieve current group view. Note that we cannot use
      // getManagerPrefix() as prefix here because there might be a manager role
      // transferring.
      const interest = createInterest(
        /*prefix=*/ $scope.group.getMemberPrefix(senderId),
        /*query=*/ 'group_view',
        /*params=*/ {
          id: $scope.userId,
          time: new Date().getTime()
        }
      );
      ndn.sendInterest(
        $scope.face,
        $scope.validator,
        interest,
        handleData,
        /*handleTimeout=*/ () => {}
      );
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData('ACK')
      );
    },

    // Handler for 'group_view' interest.
    group_view: function(receivedInterest, params) {
      // Verify interest.
      const signer = util.getComponentString(receivedInterest.name, -2);
      const publicKey = $scope.group.publicKey[signer];
      verifyInterest(receivedInterest, publicKey);
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData(
          JSON.stringify($scope.group.getGroupView())
        )
      );
    },

    // Handler for 'notify_whiteboard_update' interest.
    notify_whiteboard_update: function(receivedInterest, params) {
      // Verify interest.
      const signer = util.getComponentString(receivedInterest.name, -2);
      const publicKey = $scope.group.publicKey[signer];
      verifyInterest(receivedInterest, publicKey);
      const senderId = util.getParameterByName('id', params);
      const updateNum = util.getParameterByName('num', params);
      // TODO: send interest to fetch the update and possibily missing updates
      // that are also from the sender and have a number smaller than the latest
      // updateNum.
      // Callback to handle received data.
      const handleData = function(interest, data) {
        try {
          const dataContent = JSON.parse(decryptAndVerifyData(data.content));
          saveWhiteboardUpdate(
            dataContent.updater,
            dataContent.whiteboardUpdate
          );
          $scope.canvas.applyContentUpdate(dataContent.whiteboardUpdate);
        } catch (error) {
          $exceptionHandler(error);
        }
      };
      const interest = createInterest(
        /*prefix=*/ $scope.group.getMemberPrefix(senderId),
        /*query=*/ 'whiteboard_update',
        /*params=*/ {
          num: updateNum
        },
        /*mustBeFresh=*/ false,
        /*lifetime=*/ 2000,
        /*signBeforeReturn=*/ false
      );
      ndn.sendInterest(
        $scope.face,
        $scope.validator,
        interest,
        handleData,
        /*handleTimeout=*/ () => {}
      );
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData('ACK')
      );
    },

    // Handler for 'all_whiteboard_updates' interest.
    all_whiteboard_updates: function(receivedInterest, params) {
      // TODO: handle interest.
      return null;
    },

    // Handler for 'whiteboard_update' interest. 'whiteboard_update' interest
    // does not need to be signed so that the cached data can be used to respond
    // to 'whiteboard_update' interests from others.
    whiteboard_update: function(receivedInterest, params) {
      const updateNum = util.getParameterByName('num', params);
      return createNdnData(
        /*name=*/ receivedInterest.name,
        /*content=*/ signAndEncryptData(
          JSON.stringify({
            updater: $scope.userId,
            whiteboardUpdate: $scope.group.getWhiteboardUpdate(
              $scope.userId,
              updateNum
            )
          })
        )
      );
    }
  };

  // Notifies members of group update. Only manager will call it.
  const notifyGroupUpdate = function() {
    for (const member of $scope.group.members) {
      if (member === $scope.userId) continue;
      const interest = createInterest(
        /*prefix=*/ $scope.group.getMemberPrefix(member),
        /*query=*/ 'notify_group_update',
        /*params=*/ {
          id: $scope.userId,
          time: new Date().getTime()
        }
      );
      ndn.sendInterest($scope.face, $scope.validator, interest);
    }
  };

  // Notifies members of whiteboard update. All members will call it.
  const notifyWhiteboardUpdate = function(updateNum) {
    for (const member of $scope.group.members) {
      if (member === $scope.userId) continue;
      const interest = createInterest(
        /*prefix=*/ $scope.group.getMemberPrefix(member),
        /*query=*/ 'notify_whiteboard_update',
        /*params=*/ {
          id: $scope.userId,
          num: updateNum,
          time: new Date().getTime()
        }
      );
      ndn.sendInterest($scope.face, $scope.validator, interest);
    }
  };

  // Saves the last canvas drawing to group whiteboard updates.
  const saveWhiteboardUpdate = function(updater, update) {
    $scope.group.setWhiteboardUpdate(updater, update);
  };

  // Creates interest based on input parameters. Interest name will be
  // '/<prefix>/<query>/<params>'.
  const createInterest = function(
    prefix,
    query = 'noop',
    params = {},
    mustBeFresh = true,
    lifetime = 2000,
    signBeforeReturn = true,
    nonce = $scope.group.nonce
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
    interest.setMustBeFresh(mustBeFresh);
    interest.setInterestLifetimeMilliseconds(lifetime);
    // If [signBeforeReturn] is true, sign the interest. Otherwise, put placeholder at the
    // end of interest name.
    if (signBeforeReturn) {
      signInterest(interest, nonce);
    } else {
      interest.name.append('nosginer');
      interest.name.append('nosignature');
    }
    return interest;
  };

  // Signs interest by hashing the interest name and appending the signature to
  // the interest name.
  const signInterest = function(interest, nonce = $scope.group.nonce) {
    // Append signer id.
    interest.name.append($scope.userId);
    // Compute signature based on the concatenated string of current interest
    // name and nonce.
    const signature = $scope.signingKeyPair.sec.sign(
      sjcl.hash.sha256.hash(interest.name.toUri() + nonce)
    );
    // Append stringified signature to interest name.
    interest.name.append(JSON.stringify(signature));
  };

  // Verifies interest.
  // Interest format: '/<prefix>/<query>/<params>/<signer>/<signature>'.
  const verifyInterest = function(
    interest,
    publicKey,
    nonce = $scope.group.nonce
  ) {
    const signature = JSON.parse(util.getComponentString(interest.name, -1));
    // PrefixUri contains: '/<prefix>/<query>/<params>/<signer>'.
    const prefixUri = interest.name.getPrefix(interest.name.size() - 1).toUri();
    return publicKey.verify(
      sjcl.hash.sha256.hash(prefixUri + nonce),
      signature
    );
  };

  // Signs and encrypts data (string). Returns result in string.
  const signAndEncryptData = function(data, password = $scope.group.password) {
    // Compute signature based on the concatenated string of data and signer.
    const signature = $scope.signingKeyPair.sec.sign(
      sjcl.hash.sha256.hash(data + $scope.userId)
    );
    const signedData = {
      data: data,
      signer: $scope.userId,
      signature: signature
    };
    // Encrypt signed data and return as JSON string.
    return JSON.stringify(sjcl.encrypt(password, JSON.stringify(signedData)));
  };

  // Decrypts and verifies data (string). If succeeds, returns decrypted result
  // in string. If decryption or verification fails, throw the error.
  const decryptAndVerifyData = function(
    data,
    password = $scope.group.password,
    publicKey = null
  ) {
    // Decrypts data and parse as JSON.
    const signedData = JSON.parse(sjcl.decrypt(password, JSON.parse(data)));
    // If publicKey is not provided, look up in group member's public key.
    if (publicKey === null) {
      if (!$scope.group.hasMember(signedData.signer)) {
        throw new Error('Signer not in group.');
      }
      publicKey = $scope.group.publicKey[signedData.signer];
    }
    // Verify.
    publicKey.verify(
      sjcl.hash.sha256.hash(signedData.data + signedData.signer),
      signedData.signature
    );
    return signedData.data;
  };

  // Creates an NDN Data object.
  const createNdnData = function(name = '', content = '', freshnessPeriod = 0) {
    let metaInfo = new MetaInfo();
    metaInfo.setFreshnessPeriod(freshnessPeriod);
    return new Data(new Name(name), metaInfo, content);
  };
};

// Register controller.
ndnWhiteboardApp.controller('ndnWhiteboardCtrl', ndnWhiteboardCtrl);
