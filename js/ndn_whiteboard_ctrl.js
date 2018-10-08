ndnWhiteboardApp.controller('ndnWhiteboardCtrl',
function ($scope, $exceptionHandler, util, ndn, Group, config) {
  // DEBUG
  $scope.logMembers = function () {
    console.log($scope.group.members);
  };
  
  // Show setting and hide whiteboard in the beginning.
  $scope.showSetting = true;
  $scope.showWhiteboard = false;
  
  // Uses default NFD host.
  $scope.useDefaultNfdHost = function () {
    $scope.nfdHost = config.DEFAULT_NFD_HOST;
  };

  // Submits the NFD host and username settings, initializes the whiteboard.
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

  // Leaves the current group and creates a new group automatically.
  $scope.leaveGroup = function () {
    leaveGroup();
    createGroup();
  };

  // Copies group link to clipboard.
  $scope.shareLink = function () {
    util.copyToClipboard($scope.group.getGroupLink());
  };

  // Tries to join an existing group through group link.
  $scope.joinGroup = function () {
    joinGroup();
  };

  // Creates a new group as the initial manager and registers related prefixes.
  const createGroup = function () {
    $scope.group = new Group(util.getRandomId('group', 6), config.URI_PREFIX, $scope.userId);
    // Try to register manager prefix and member prefix.
    try {
      $scope.managerPrefixId = registerManagerPrefix();
      $scope.memeberPrefixId = registerMemberPrefix();
    } catch (error) {
      $exceptionHandler(error);
    }
  };

  // Tries to join an existing group through group link.
  const joinGroup = function () {
    const groupLink = $scope.groupLink;
    if (groupLink === $scope.group.getGroupLink()) {
      console.log('Already in group. Group link:', groupLink);
      return;
    };

    // Callback to handle received data. Note that all callbacks that manipulate
    // $scope data should be wrapped in $scope.$apply() for them to be updated
    // timely.
    const handleData = function (interest, data) {
      $scope.$apply(function () {
        const dataContent = JSON.parse(data.content);
        if (dataContent.accept) {
          leaveGroup();
          $scope.group.setGroupView(dataContent.groupView);
          $scope.group.setWhiteboardUpdates(dataContent.whiteboardUpdates);
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

  // Leaves the current group by notifying the manager and removing registered
  // prefixes. If the user is group manager, it will automatically send interest
  // to transfer manager role to another member if there is any.
  const leaveGroup = function () {
    if (!$scope.group) return;
    if ($scope.userId == $scope.group.manager) {
      // TODO: transfer manager role to another group member.
    } else {
      // Send notify_leave to group manager.
      const interest = ndn.createInterest(
        name = $scope.group.getManagerPrefix() + '/notify_leave',
        params = {
          id: $scope.userId
        }, lifetime = 2000, mustBeFresh = true);
      ndn.sendInterest($scope.face, interest);
    }

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
          case 'request_join': return handleRequestJoin(senderId);
          case 'notify_leave': return handleNotifyLeave(senderId);
          case 'group_view': return handleGroupView();
          case 'whiteboard_updates': break;
          default: break;
        }
        return null;
      });
    };
    // Return registered prefix ID.
    return ndn.registerPrefix($scope.face, $scope.group.getManagerPrefix(), handleInterest);
  };

  const handleRequestJoin = function(requester) {
    // Add requester to group and notify members of group update.
    $scope.group.addMember(requester);
    notifyGroupUpdate();
    // Reponse includes accept decision and all current group data.
    return createData(JSON.stringify({
      accept: true,
      groupView: $scope.group.getGroupView(),
      whiteboardUpdates: $scope.group.getWhiteboardUpdates()
    }));
  };

  const handleNotifyLeave = function(leaver) {
    // Remove leaver from group and notify members of group update.
    $scope.group.removeMember(leaver);
    notifyGroupUpdate();
    return createData('ACK');
  };

  const handleGroupView = function() {
    return createData(JSON.stringify($scope.group.getGroupView()));
  };

  // Notifies members of group update. Only manager will call it.
  const notifyGroupUpdate = function () {
    for (member of $scope.group.members) {
      if (member === $scope.group.manager) continue;
      const interest = ndn.createInterest(
        name = $scope.group.getMemberPrefix(member) + '/notify_group_update',
        params = {
          id: $scope.group.manager
        }, lifetime = 2000, mustBeFresh = true);
      ndn.sendInterest($scope.face, interest);
    }
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
          case 'notify_group_update': return handleNotifyGroupUpdate();
          case 'notify_whiteboard_update': break;
          case 'whiteboard_update': break;
          default: break;
        }
        return null;
      });
    };
    // Return registered prefix ID.
    return ndn.registerPrefix($scope.face,
      $scope.group.getMemberPrefix($scope.userId), handleInterest);
  };

  const handleNotifyGroupUpdate = function() {
    // Callback to handle received data.
    const handleData = function (interest, data) {
      $scope.$apply(function () {
        $scope.group.setGroupView(JSON.parse(data.content));
      });
    };
    // Send interest to retrieve current group view.
    const interest = ndn.createInterest(
      name = $scope.group.getManagerPrefix() + '/group_view',
      params = {
        id: $scope.userId
      }, lifetime = 2000, mustBeFresh = true);
    ndn.sendInterest($scope.face, interest, handleData);
    return createData('ACK');
  };

  // Creates a Data object.
  const createData = function (content = '', name = '', freshnessPeriod = 0) {
    let metaInfo = new MetaInfo();
    metaInfo.setFreshnessPeriod(freshnessPeriod);
    return new Data(new Name(name), metaInfo, content);
  };
});
