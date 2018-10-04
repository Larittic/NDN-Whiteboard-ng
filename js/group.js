class Group {
  constructor(groupId, manager) {
    this.groupId = groupId;
    this.manager = manager;
    this.members = [manager];
    this.whiteboardUpdates = {};
  }

  hasMember(member) {
    return this.members.indexOf(member) > -1;
  }

  addMember(member) {
    if (this.hasMember(member)) return false;
    this.members.push(member);
    return true;
  }

  removeMember(member) {
    const index = this.members.indexOf(member);
    if (index === -1) return false;
    this.members.splice(index, 1);
    return true;
  }

  getGroupView() {
    return {
      groupId: this.groupId,
      manager: this.manager,
      members: this.members
    };
  }

  setGroupView(groupView) {
    this.groupId = groupView.groupId;
    this.manager = groupView.manager;
    this.members = groupView.members;
  }

  getWhiteboardUpdates() {
    return this.whiteboardUpdates;
  }

  setWhiteboardUpdates(whiteboardUpdates) {
    this.whiteboardUpdates = whiteboardUpdates;
  }

  getSingleWhiteboardUpdate(member, updateNum) {
    if (!this.hasMember(member)) return null;
    const key = member + '#' + updateNum;
    if (!(key in this.whiteboardUpdates)) return null;
    return this.whiteboardUpdates[key];
  }

  setSingleWhiteboardUpdate(member, updateNum, updateContent) {
    if (!this.hasMember(member)) return false;
    const key = member + '#' + updateNum;
    this.whiteboardUpdates[key] = updateContent;
    return true;
  }
}
