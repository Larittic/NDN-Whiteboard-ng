const ndnWhiteboardCtrl = function(
  $scope,
  $window,
  $exceptionHandler,
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
    // Initialize canvas.
    $scope.canvas = new Canvas(document.getElementById('canvas'));
    // Num of last canvas update from user drawing (not from other group
    // members). It is used to check if there is a fresh canvas update.
    $scope.canvasLastUpdateNum = -1;
    // Create NDN face.
    $scope.face = new Face({ host: $scope.nfdHost });
    // Create NDN key chain.
    $scope.keyChain = new KeyChain('pib-memory:', 'tpm-memory:');
    // Create default identity and set it as command signing info.
    $scope.keyChain.createIdentityV2(
      (identityName = new Name('defaultIdentity')),
      (params = KeyChain.getDefaultKeyParams()),
      (onComplete = function() {
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
      }),
      (onError = function(error) {
        $exceptionHandler(error);
      })
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
      util.getRandomId('group', 6),
      config.URI_PREFIX,
      $scope.userId
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

    // Callback to handle received data. Note that all callbacks that manipulate
    // $scope data should be wrapped in $scope.$apply() for them to be updated
    // timely.
    const handleData = function(interest, data) {
      $scope.$apply(function() {
        const dataContent = JSON.parse(data.content);
        if (dataContent.accept) {
          leaveGroup();
          $scope.group.setGroupView(dataContent.groupView);
          $scope.group.setAllWhiteboardUpdates(dataContent.whiteboardUpdates);
          // Set canvas content.
          $scope.canvas.setContentUpdates(
            Object.values(dataContent.whiteboardUpdates)
          );
          // Try to register member prefix.
          try {
            $scope.memeberPrefixId = registerMemberPrefix();
          } catch (error) {
            $exceptionHandler(error);
          }
        } else {
          console.log('Join group request rejected. Group link:', groupLink);
        }
      });
    };

    // Callback to handle timeout.
    const handleTimeout = function(interest) {
      console.log('Join group request timeout. Group link:', groupLink);
    };

    const parsedGroupLink = parseGroupLink(groupLink);
    const interest = ndn.createInterest(
      (prefix = parsedGroupLink.prefix),
      (command = 'request_join'),
      (params = {
        id: $scope.userId
      }),
      (lifetime = 2000),
      (mustBeFresh = true)
    );
    ndn.sendInterest($scope.face, interest, handleData, handleTimeout);
  };

  const parseGroupLink = function(groupLink) {
    return {
      prefix: groupLink
    };
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

    if ($scope.userId === $scope.group.manager) {
      // If the user is group manager, send manager_leave interest to another
      // member who will become the new manager and notify the group.
      const newManager = PickNewManager();
      if (newManager) {
        const interest = ndn.createInterest(
          (prefix = $scope.group.getMemberPrefix(newManager)),
          (command = 'manager_leave'),
          (params = {
            id: $scope.userId
          }),
          (lifetime = 2000),
          (mustBeFresh = true)
        );
        ndn.sendInterest($scope.face, interest);
      }
    } else {
      // Send notify_leave to group manager.
      const interest = ndn.createInterest(
        (prefix = $scope.group.getManagerPrefix()),
        (command = 'notify_leave'),
        (params = {
          id: $scope.userId
        }),
        (lifetime = 2000),
        (mustBeFresh = true)
      );
      ndn.sendInterest($scope.face, interest);
    }

    // Clear canvas content and reset last update number.
    $scope.canvas.clearContentUpdates();
    $scope.canvasLastUpdateNum = -1;
    // Reset as empty group.
    $scope.group = new Group();
  };

  const PickNewManager = function() {
    if ($scope.group.members.length > 1) {
      return $scope.group.members[
        $scope.group.members[0] === $scope.userId ? 1 : 0
      ];
    } else {
      return null;
    }
  };

  // Registers member prefix. Returns registered prefix ID if succeeds.
  const registerMemberPrefix = function() {
    // Callback to handle interest.
    const handleInterest = function(interest) {
      return $scope.$apply(function() {
        const queryAndParams = util.getQueryAndParams(interest);
        /* To delete later or move to interest handlers.
        if (!util.getParameterByName('id', queryAndParams.params)) {
          throw new Error(
            `Missing parameter 'id' in interest ${interest.getName().toUri()}.`
          );
        }
        */
        if (queryAndParams.query in interestHandler) {
          return interestHandler[queryAndParams.query](queryAndParams.params);
        }
        return null;
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
    request_join: function(params) {
      if ($scope.userId !== $scope.group.manager) return null;
      const requester = util.getParameterByName('id', params);
      // Add requester to group and notify members of group update.
      $scope.group.addMember(requester);
      notifyGroupUpdate();
      // Reponse includes accept decision and all current group data.
      return createData(
        JSON.stringify({
          accept: true,
          groupView: $scope.group.getGroupView(),
          whiteboardUpdates: $scope.group.getAllWhiteboardUpdates()
        })
      );
    },

    // Handler for 'notify_leave' interest. Only manager will call it.
    notify_leave: function(params) {
      if ($scope.userId !== $scope.group.manager) return null;
      const leaver = util.getParameterByName('id', params);
      // Remove leaver from group and notify members of group update.
      $scope.group.removeMember(leaver);
      notifyGroupUpdate();
      return createData('ACK');
    },

    // Handler for 'manager_leavel interest.
    manager_leave: function(params) {
      const previousManager = util.getParameterByName('id', params);
      // Remove the previous manager from group and take over the manager role.
      $scope.group.removeMember(previousManager);
      $scope.group.manager = $scope.userId;
      // Notify members of group update.
      notifyGroupUpdate();
      return createData('ACK');
    },

    // Handler for 'notify_group_update' interest.
    notify_group_update: function(params) {
      const senderId = util.getParameterByName('id', params);
      // Callback to handle received data.
      const handleData = function(interest, data) {
        $scope.$apply(function() {
          $scope.group.setGroupView(JSON.parse(data.content));
        });
      };
      // Send interest to retrieve current group view. Note that we cannot use
      // getManagerPrefix() as prefix here because there might be a manager role
      // transferring.
      const interest = ndn.createInterest(
        (prefix = $scope.group.getMemberPrefix(senderId)),
        (command = 'group_view'),
        (params = {
          id: $scope.userId
        }),
        (lifetime = 2000),
        (mustBeFresh = true)
      );
      ndn.sendInterest(
        $scope.face,
        interest,
        handleData,
        (handleTimeout = () => {}),
        (retry = 1)
      );
      return createData('ACK');
    },

    // Handler for 'group_view' interest.
    group_view: function(params) {
      return createData(JSON.stringify($scope.group.getGroupView()));
    },

    // Handler for 'notify_whiteboard_update' interest.
    notify_whiteboard_update: function(params) {
      const senderId = util.getParameterByName('id', params);
      const updateNum = util.getParameterByName('num', params);
      // TODO: send interest to fetch the update and possibily missing updates
      // that are also from the sender and have a number smaller than the latest
      // updateNum.
      // Callback to handle received data.
      const handleData = function(interest, data) {
        const dataContent = JSON.parse(data.content);
        saveWhiteboardUpdate(dataContent.updater, dataContent.whiteboardUpdate);
        $scope.canvas.applyContentUpdate(dataContent.whiteboardUpdate);
      };
      const interest = ndn.createInterest(
        (prefix = $scope.group.getMemberPrefix(senderId)),
        (command = 'whiteboard_update'),
        (params = {
          id: $scope.userId,
          num: updateNum
        }),
        (lifetime = 2000),
        (mustBeFresh = false)
      );
      ndn.sendInterest(
        $scope.face,
        interest,
        handleData,
        (handleTimeout = () => {}),
        (retry = 1)
      );
      return createData('ACK');
    },

    // Handler for 'all_whiteboard_updates' interest.
    all_whiteboard_updates: function(params) {
      // TODO: handle interest.
      return null;
    },

    // Handler for 'whiteboard_update' interest.
    whiteboard_update: function(params) {
      const senderId = util.getParameterByName('id', params);
      const updateNum = util.getParameterByName('num', params);
      return createData(
        JSON.stringify({
          updater: $scope.userId,
          whiteboardUpdate: $scope.group.getWhiteboardUpdate(
            $scope.userId,
            updateNum
          )
        })
      );
    }
  };

  // Notifies members of group update. Only manager will call it.
  const notifyGroupUpdate = function() {
    for (member of $scope.group.members) {
      if (member === $scope.userId) continue;
      const interest = ndn.createInterest(
        (prefix = $scope.group.getMemberPrefix(member)),
        (command = 'notify_group_update'),
        (params = {
          id: $scope.userId
        }),
        (lifetime = 2000),
        (mustBeFresh = true)
      );
      ndn.sendInterest($scope.face, interest);
    }
  };

  // Notifies members of whiteboard update. All members will call it.
  const notifyWhiteboardUpdate = function(updateNum) {
    for (member of $scope.group.members) {
      if (member === $scope.userId) continue;
      const interest = ndn.createInterest(
        (prefix = $scope.group.getMemberPrefix(member)),
        (command = 'notify_whiteboard_update'),
        (params = {
          id: $scope.userId,
          num: updateNum
        }),
        (lifetime = 2000),
        (mustBeFresh = true)
      );
      ndn.sendInterest($scope.face, interest);
    }
  };

  // Saves the last canvas drawing to group whiteboard updates.
  const saveWhiteboardUpdate = function(updater, update) {
    $scope.group.setWhiteboardUpdate(updater, update);
  };

  // Creates a Data object.
  const createData = function(content = '', name = '', freshnessPeriod = 0) {
    let metaInfo = new MetaInfo();
    metaInfo.setFreshnessPeriod(freshnessPeriod);
    return new Data(new Name(name), metaInfo, content);
  };
};

// Register controller.
ndnWhiteboardApp.controller('ndnWhiteboardCtrl', ndnWhiteboardCtrl);
