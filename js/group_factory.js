const groupFactory = function(util, $httpParamSerializer) {
  // Returns a new group object.
  const Group = function(
    groupId = 'empty_group_id',
    uriPrefix = 'empty_uri_prefix',
    manager = 'empty_manager',
    managerPublicKey = null,
    passwordLength = 16,
    nonceLength = 8
  ) {
    this.id = groupId;
    this.uri = uriPrefix + '/' + groupId;
    this.manager = manager;
    // Array of member IDs.
    this.members = [manager];
    // Map from member to public key.
    this.publicKey = {};
    this.publicKey[manager] = managerPublicKey;
    // Symmetric encryption password used to encrypt data.
    this.password = util.getRandomString(passwordLength);
    // Random nonce string used for verification when user requests to join.
    this.nonce = util.getRandomString(nonceLength);
    // The whiteboard updates map. Key is [member] + '#' + [updateNum], value is
    // the update content. e.g.,
    //   key: 'A-02Y72D#1'
    //   value: {
    //     num: 0,
    //     time: 1539923966179,
    //     strokeStyle: "black",
    //     lineWidth: 2,
    //     stroke: [{x: 0, y: 0}, {x: 1, y: 1}]
    //   }
    this.whiteboardUpdates = {};

    // Returns true if [member] exists in [this.members].
    this.hasMember = function(member) {
      return this.members.indexOf(member) > -1;
    };

    // Adds memberto group. Returns true if succeeds.
    this.addMember = function(member, publicKey) {
      if (this.hasMember(member)) return false;
      this.members.push(member);
      this.publicKey[member] = publicKey;
      return true;
    };

    // Removes member from group. Returns true if succeeds.
    this.removeMember = function(member) {
      const index = this.members.indexOf(member);
      if (index === -1) return false;
      this.members.splice(index, 1);
      delete this.publicKey[member];
      return true;
    };

    // Returns the group view object, containing all group properties except the
    // whiteboard updates.
    this.getGroupView = function() {
      // Serialize public keys.
      const publicKey = {};
      for (const member in this.publicKey) {
        publicKey[member] = util.serializePublicKey(this.publicKey[member]);
      }
      return {
        id: this.id,
        uri: this.uri,
        manager: this.manager,
        members: this.members,
        publicKey: publicKey,
        password: this.password,
        nonce: this.nonce
      };
    };

    // Sets group properties according to the input group view object.
    this.setGroupView = function(groupView) {
      this.id = groupView.id;
      this.uri = groupView.uri;
      this.manager = groupView.manager;
      this.members = groupView.members;
      this.password = groupView.password;
      this.nonce = groupView.nonce;
      // Unserialize public keys and set [this.publicKey].
      this.publicKey = {};
      for (const member in groupView.publicKey) {
        this.publicKey[member] = util.unserializePublicKey(
          groupView.publicKey[member]
        );
      }
    };

    // Returns all whiteboard updates.
    this.getAllWhiteboardUpdates = function() {
      return util.deepcopy(this.whiteboardUpdates);
    };

    // Sets whiteboard updates according to input.
    this.setAllWhiteboardUpdates = function(whiteboardUpdates) {
      this.whiteboardUpdates = util.deepcopy(whiteboardUpdates);
    };

    // Returns the whiteboard update of the key [member] + '#' + [updateNum].
    this.getWhiteboardUpdate = function(member, updateNum) {
      if (!this.hasMember(member)) return null;
      const key = member + '#' + updateNum;
      if (!(key in this.whiteboardUpdates)) return null;
      // Deep copy.
      return util.deepcopy(this.whiteboardUpdates[key]);
    };

    // Sets a whiteboard update. The key is [member] + '#' + [update.num].
    this.setWhiteboardUpdate = function(member, update) {
      if (!this.hasMember(member)) return false;
      const key = member + '#' + update.num;
      this.whiteboardUpdates[key] = util.deepcopy(update);
      return true;
    };

    // Returns true if there exists a whiteboard update of the key [member] + '#' + [updateNum].
    this.hasWhiteboardUpdate = function(member, updateNum) {
      return member + '#' + updateNum in this.whiteboardUpdates;
    };

    // Returns the manager's NDN prefix.
    this.getManagerPrefix = function() {
      return this.getMemberPrefix(this.manager);
    };

    // Returns a member's NDN prefix.
    this.getMemberPrefix = function(member) {
      if (!this.hasMember(member)) return null;
      return this.uri + '/' + member;
    };

    // Picks a new manager. It is only called by manager when he is leaving
    // group and needs to hand over manager role.
    this.pickNewManager = function() {
      if (this.members.length > 1) {
        return this.members[this.members[0] === this.manager ? 1 : 0];
      } else {
        return null;
      }
    };

    // Returns the group link that can be used by other users to join.
    this.getGroupLink = function() {
      const paramString = $httpParamSerializer({
        managerPublicKey: util.serializePublicKey(this.publicKey[this.manager]),
        password: this.password,
        nonce: this.nonce
      });
      return this.getManagerPrefix() + '?' + paramString;
    };
  };

  // (static) Parses the group link.
  Group.parseGroupLink = function(groupLink) {
    const splited = groupLink.split('?');
    const prefix = splited[0];
    const params = '?' + splited[1];
    return {
      prefix: prefix,
      managerPublicKey: util.unserializePublicKey(
        util.getParameterByName('managerPublicKey', params)
      ),
      password: util.getParameterByName('password', params),
      nonce: util.getParameterByName('nonce', params)
    };
  };

  return Group;
};

// Register factory.
ndnWhiteboardApp.factory('Group', groupFactory);
