ndnWhiteboardApp.controller('ndnWhiteboardCtrl', function ($scope, $exceptionHandler, util, ndn, Group, config) {
  // DEBUG
  $scope.logMembers = function () {
    console.log($scope.group.members);
  };
  
  // Show setting and hide whiteboard in the beginning.
  $scope.showSetting = true;
  $scope.showWhiteboard = false;
  
  $scope.useDefaultNfdHost = function () {
    $scope.nfdHost = config.DEFAULT_NFD_HOST;
  };

  $scope.submitSetting = function () {
    // Get user ID by randomizing based on input username. 
    $scope.userId = util.getRandomId($scope.username, 6);
    // Create NDN face.
    $scope.face = ndn.createFace($scope.nfdHost, $scope.userId, {
      publicKey: config.DEFAULT_RSA_PUBLIC_KEY_DER,
      privateKey: config.DEFAULT_RSA_PRIVATE_KEY_DER
    });
    // Create a new group as manager.
    createGroup();
    // Hide setting and show whiteboard.
    $scope.showSetting = false;
    $scope.showWhiteboard = true;
  };

  $scope.leaveGroup = function () {
    leaveGroup();
    createGroup();
  }

  $scope.joinGroup = function () {
    const groupLink = $scope.groupLink;

    // Callback to handle received data. Note that all callbacks that manipulate
    // $scope data should be wrapped in $scope.$apply() for them to be updated
    // timely.
    const handleData = function (interest, data) {
      $scope.$apply(function () {
        const dataContent = JSON.parse(data.content);
        if (dataContent.accept) {
          leaveGroup();
          joinGroup(dataContent.groupView, dataContent.whiteboardUpdates);
        } else {
          console.log('Join group request rejected. Group link:', groupLink);
        }
      });
    };

    // Callback to handle timeout.
    const handleTimeout = function (interest) {
      console.log('Join group request timeout. Group link:', groupLink);
    };

    const parsedGroupLink = parseGroupLink(groupLink);
    const interest = ndn.createInterest(
      name = parsedGroupLink.uri + '/manager/request_join',
      params = {
        id: $scope.userId
      }, lifetime = 2000, mustBeFresh = true);
    ndn.sendInterest($scope.face, interest, handleData, handleTimeout);
  };

  const parseGroupLink = function (groupLink) {
    return {
      uri: groupLink
    }
  };

  // Creates a new group as the initial manager and registers related prefixes.
  const createGroup = function () {
    $scope.group = new Group(util.getRandomId('group', 6), config.URI_PREFIX, $scope.userId);
    // Try to register manager prefix and member prefix.
    try {
      $scope.managerPrefixId = registerManagerPrefix($scope.group, $scope.face);
      $scope.memeberPrefixId = registerMemberPrefix($scope.group, $scope.userId, $scope.face);
    } catch (error) {
      $exceptionHandler(error);
    }
  };

  // Joins an existing group.
  const joinGroup = function (groupView, whiteboardUpdates) {
    if (!$scope.group) return;
    $scope.group.setGroupView(groupView);
    $scope.group.setWhiteboardUpdates(whiteboardUpdates);
    // Try to register member prefix.
    try {
      $scope.memeberPrefixId = registerMemberPrefix($scope.group, $scope.userId, $scope.face);
    } catch (error) {
      $exceptionHandler(error);
    }
  };

  // Leaves the current group.
  const leaveGroup = function () {
    if (!$scope.group) return;
    // TODO: transfer manager role to another group member.
    // TODO: send notify_leave to group manager.
    // Remove registered prefix.
    if ($scope.managerPrefixId) {
      ndn.removeRegisteredPrefix($scope.face, $scope.managerPrefixId);
    }
    if ($scope.memeberPrefixId) {
      ndn.removeRegisteredPrefix($scope.face, $scope.memeberPrefixId);
    }
  };

  // Registers manager prefix. Returns registered prefix ID if succeeds.
  const registerManagerPrefix = function () {
    // Callback to handle interest.
    const handleInterest = function (interest) {
      return $scope.$apply(function () {
        const queryAndParams = util.getQueryAndParams(interest);
        const senderId = util.getParameterByName('id', queryAndParams.params);
        if (!senderId) {
          throw new Error(`Missing parameter 'id' in interest ${interest.getName().toUri()}`);
        }
        switch (queryAndParams.query) {
          // TODO: handle different query.
          case 'request_join':
            $scope.group.addMember(senderId);
            // Send interest to every member except the sender to notify group
            // update. The sender will get the full group view from reponse.
            for (member of $scope.group.members) {
              if (member === $scope.group.manager || member === senderId) continue;
              const interest = ndn.createInterest(
                name = $scope.group.getMemberPrefix(member) + '/notify_group_update',
                params = {
                  id: $scope.group.manager
                }, lifetime = 2000, mustBeFresh = true);
              ndn.sendInterest($scope.face, interest);
            }
            return new Data(new Name(), new MetaInfo(), JSON.stringify({
              accept: true,
              groupView: $scope.group.getGroupView(),
              whiteboardUpdates: $scope.group.getWhiteboardUpdates()
            }));
          case 'notify_leave':
            break;
          case 'group_view':
            return new Data(new Name(), new MetaInfo(),
              JSON.stringify($scope.group.getGroupView()));
          case 'whiteboard_updates':
            break;
          default:
            break;
        }
        return null;
      });
    };
    // Return registered prefix ID.
    return ndn.registerPrefix($scope.face, $scope.group.getManagerPrefix(), handleInterest);
  };

  // Registers member prefix. Returns registered prefix ID if succeeds.
  const registerMemberPrefix = function () {
    // Callback to handle interest.
    const handleInterest = function (interest) {
      return $scope.$apply(function () {
        const queryAndParams = util.getQueryAndParams(interest);
        const senderId = util.getParameterByName('id', queryAndParams.params);
        if (!senderId) {
          throw new Error(`Missing parameter 'id' in interest ${interest.getName().toUri()}`);
        }
        switch (queryAndParams.query) {
          // TODO: handle different query.
          case 'notify_group_update':
            break;
          case 'notify_whiteboard_update':
            break;
          case 'whiteboard_update':
            break;
          default:
            break;
        }
        return null;
      });
    };
    // Return registered prefix ID.
    return ndn.registerPrefix($scope.face,
      $scope.group.getMemberPrefix($scope.userId), handleInterest);
  };
});
