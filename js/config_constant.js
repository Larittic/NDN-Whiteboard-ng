const configConstant = {
  // URI prefix of all NDN name prefixes.
  URI_PREFIX: '/ndn-whiteboard',
  // Default NFD host. If met DNS problem, try '128.97.98.8'.
  DEFAULT_NFD_HOST: 'memoria.ndn.ucla.edu',
  // Default uer ID.
  DEFAULT_USER_ID: 'user'
};

// Register constant.
ndnWhiteboardApp.constant('config', configConstant);
