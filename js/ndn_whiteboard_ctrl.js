ndnWhiteboardApp.controller('ndnWhiteboardCtrl', function ($scope, util, ndn, Group, config) {
  $scope.useDefaultNfdHost = function () {
    $scope.nfdHost = config.DEFAULT_NFD_HOST;
  };

  $scope.submitSetting = function () {
    $scope.userId = util.getRandomId($scope.userId, 6);
    $scope.group = new Group(util.getRandomId('group', 6), config.URI_PREFIX, $scope.userId);

    // Hide setting and show whiteboard.
    $scope.showSetting = false;
    $scope.showWhiteboard = true;
  };

  $scope.joinGroupByLink = function () {
    // TODO: join group by link.
  };

  // Creates a new group as the initial manager.
  const createGroup = function (manager) {
    const group = new Group(util.getRandomId('group', 6), config.URI_PREFIX, manager);
    // TODO: register group prefix and member prefix.
    return group;
  };

  // Joins an existing group.
  const joinGroup = function () {
    // TODO: register group prefix and member prefix.
  };

  // Leaves the current group.
  const leaveGroup = function () {
    // TODO: remove group prefix and member prefix.
  };

  // Registers manager prefix. Returns registered prefix ID if succeeds.
  const registerManagerPrefix = function (group) {
    // Callback to handle interest.
    const handleInterest = function (interest) {
      const queryAndParams = util.getQueryAndParams(interest);
      const userId = util.getParameterByName('id', queryAndParams.params);
      if (!userId) {
        throw new Error(`Missing parameter 'id' in interest ${interest.getName().toUri()}`);
      }
      switch (queryAndParams.query) {
        // TODO: handle different query.
        case 'request_join':
          break;
        case 'notify_leave':
          break;
        case 'group_view':
          break;
        case 'whiteboard_updates':
          break;
        default:
          break;
      }
      return null;
    };
    // Return registered prefix ID.
    return ndn.registerPrefix($scope.face, group.getManagerPrefix(), handleInterest);
  };

  // Registers member prefix. Returns registered prefix ID if succeeds.
  const registerMemberPrefix = function (group, member) {
    // Throw an error if [member] is not in [group].
    if (!group.hasMember(member)) {
      throw Error(`Member ${member} not in group ${group.id}.`);
    }
    // Callback to handle interest.
    const handleInterest = function (interest) {
      const queryAndParams = util.getQueryAndParams(interest);
      const userId = util.getParameterByName('id', queryAndParams.params);
      if (!userId) {
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
    };
    // Return registered prefix ID.
    return ndn.registerPrefix($scope.face, group.getMemberPrefix(member), handleInterest);
  };

  // Initialization.
  {
    // Show setting and hide whiteboard in the beginning.
    $scope.showSetting = true;
    $scope.showWhiteboard = false;
/*
    // DEBUG: submit default setting and go to whiteboard directly.
    $scope.nfdHost = DEFAULT_NFD_HOST;
    $scope.userId = util.getRandomId(DEFAULT_USER_ID, 6);
    $scope.submitSetting();

    // DEBUG: create a new group.
    $scope.group = createGroup($scope.userId);

    $scope.group.addMember('dasdada');
    $scope.group.addMember('Alice');
    $scope.group.addMember('Jon');
    $scope.group.addMember('Geralt');
    $scope.group.manager = 'Geralt';

    
    // DEBUG: create face with default setting.
    $scope.face = ndn.createFace($scope.nfdHost, $scope.userId, {
      publicKey: DEFAULT_RSA_PUBLIC_KEY_DER,
      privateKey: DEFAULT_RSA_PRIVATE_KEY_DER
    });

    // DEBUG: send an interest.
    const interest = ndn.createInterest(name = 'witcher/geralt',
      params = {
        a: 1,
        b: 2
      }, lifetime = 2000, mustBeFresh = true);
    ndn.sendInterest($scope.face, interest, handleData = () => {},
      handleTimeout = () => {}, retry = 1);
      */
  }
});
