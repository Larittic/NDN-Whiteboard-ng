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
    // Try to register member prefix.
    try {
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
      prefix = parsedGroupLink.prefix,
      command = 'request_join',
      params = {
        id: $scope.userId
      }, lifetime = 2000, mustBeFresh = true);
    ndn.sendInterest($scope.face, interest, handleData, handleTimeout);
  };

  const parseGroupLink = function (groupLink) {
    return {
      prefix: groupLink
    }
  };

  // Leaves the current group by removing registered prefixes and notifying the
  // manager. If the user is group manager, instead of notifying the manger, it
  // will send manager_leave interest to another member if there is any. The
  // member become the new manager and notify the group.
  //
  // * Note that, when the manager leaves the group, group link also changes.
  const leaveGroup = function () {
    if (!$scope.group) return;
    // Remove registered prefix.
    if ($scope.memeberPrefixId) {
      ndn.removeRegisteredPrefix($scope.face, $scope.memeberPrefixId);
    }

    if ($scope.userId === $scope.group.manager) {
      // If the user is group manager, send manager_leave interest to another
      // member who will become the new manager and notify the group.
      if ($scope.group.members.length > 1) {
        const newManager = $scope.group.members[$scope.group.members[0] === $scope.userId ? 1 : 0];
        const interest = ndn.createInterest(
          prefix = $scope.group.getMemberPrefix(newManager),
          command = 'manager_leave',
          params = {
            id: $scope.userId
          }, lifetime = 2000, mustBeFresh = true);
        ndn.sendInterest($scope.face, interest);
      }
    } else {
      // Send notify_leave to group manager.
      const interest = ndn.createInterest(
        prefix = $scope.group.getManagerPrefix(),
        command = 'notify_leave',
        params = {
          id: $scope.userId
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
          // Only manager will handle these two queries.
          case 'request_join': return handleRequestJoin(senderId);
          case 'notify_leave': return handleNotifyLeave(senderId);
          // All group members will handle these queries.
          case 'manager_leave': return handleManagerLeave(senderId);
          case 'notify_group_update': return handleNotifyGroupUpdate(senderId);
          case 'group_view': return handleGroupView();
          case 'notify_whiteboard_update': break;
          case 'all_whiteboard_updates': break;
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

  const handleRequestJoin = function(requester) {
    if ($scope.userId !== $scope.group.manager) return null;
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
    if ($scope.userId !== $scope.group.manager) return null;
    // Remove leaver from group and notify members of group update.
    $scope.group.removeMember(leaver);
    notifyGroupUpdate();
    return createData('ACK');
  };

  const handleManagerLeave = function (previousManager) {
    // Remove the previous manager from group and take over the manager role.
    $scope.group.removeMember(previousManager);
    $scope.group.manager = $scope.userId;
    // Notify members of group update.
    notifyGroupUpdate();
    return createData('ACK');
  };

  const handleNotifyGroupUpdate = function(senderId) {
    // Callback to handle received data.
    const handleData = function (interest, data) {
      $scope.$apply(function () {
        $scope.group.setGroupView(JSON.parse(data.content));
      });
    };
    // Send interest to retrieve current group view. Note that we cannot use
    // getManagerPrefix() as prefix here because there might be a manager role
    // transferring.
    const interest = ndn.createInterest(
      prefix = $scope.group.getMemberPrefix(senderId),
      command = 'group_view',
      params = {
        id: $scope.userId
      }, lifetime = 2000, mustBeFresh = true);
    ndn.sendInterest($scope.face, interest, handleData,
      handleTimeout = () => {}, retry = 1);
    return createData('ACK');
  };

  const handleGroupView = function() {
    return createData(JSON.stringify($scope.group.getGroupView()));
  };

  // Notifies members of group update. Only manager will call it.
  const notifyGroupUpdate = function () {
    for (member of $scope.group.members) {
      if (member === $scope.userId) continue;
      const interest = ndn.createInterest(
        prefix = $scope.group.getMemberPrefix(member),
        command = 'notify_group_update',
        params = {
          id: $scope.userId
        }, lifetime = 2000, mustBeFresh = true);
      ndn.sendInterest($scope.face, interest);
    }
  };

  // Creates a Data object.
  const createData = function (content = '', name = '', freshnessPeriod = 0) {
    let metaInfo = new MetaInfo();
    metaInfo.setFreshnessPeriod(freshnessPeriod);
    return new Data(new Name(name), metaInfo, content);
  };
});
