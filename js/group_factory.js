ndnWhiteboardApp.factory('Group', function () {
  return function (groupId, uriPrefix, manager) {
    this.id = groupId;
    this.uri = uriPrefix + '/' + groupId;
    this.manager = manager;
    this.members = [manager];
    this.whiteboardUpdates = {};

    this.hasMember = function (member) {
      return this.members.indexOf(member) > -1;
    };

    this.addMember = function (member) {
      if (this.hasMember(member)) return false;
      this.members.push(member);
      return true;
    };

    this.removeMember = function (member) {
      const index = this.members.indexOf(member);
      if (index === -1) return false;
      this.members.splice(index, 1);
      return true;
    };

    this.getGroupView = function () {
      return {
        id: this.id,
        uri: this.uri,
        manager: this.manager,
        members: this.members
      };
    };

    this.setGroupView = function (groupView) {
      this.id = groupView.id;
      this.uri = groupView.uri;
      this.manager = groupView.manager;
      this.members = groupView.members;
    };

    this.getWhiteboardUpdates = function () {
      return this.whiteboardUpdates;
    };

    this.setWhiteboardUpdates = function (whiteboardUpdates) {
      this.whiteboardUpdates = whiteboardUpdates;
    };

    this.getSingleWhiteboardUpdate = function (member, updateNum) {
      if (!this.hasMember(member)) return null;
      const key = member + '#' + updateNum;
      if (!(key in this.whiteboardUpdates)) return null;
      return this.whiteboardUpdates[key];
    };

    this.setSingleWhiteboardUpdate = function (member, updateNum, updateContent) {
      if (!this.hasMember(member)) return false;
      const key = member + '#' + updateNum;
      this.whiteboardUpdates[key] = updateContent;
      return true;
    };

    this.getManagerPrefix = function () {
      return this.getMemberPrefix(this.manager);
    };

    this.getMemberPrefix = function (member) {
      if (!this.hasMember(member)) return null;
      return this.uri + '/' + member;
    };

    this.getGroupLink = function () {
      return this.getManagerPrefix();
    };
  };
});
