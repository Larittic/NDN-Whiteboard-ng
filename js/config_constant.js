const configConstant = {
  // URI prefix of all NDN name prefixes.
  URI_PREFIX: '/ndn-whiteboard',
  // NFD multicast interest name prefix.
  MULTICAST_PREFIX: '/ndn/broadcast',
  // Default NFD host. If met DNS problem, try '128.97.98.8'.
  DEFAULT_NFD_HOST: 'memoria.ndn.ucla.edu',
  // Default uer ID.
  DEFAULT_USER_ID: 'user',
  // Canvas stroke style (color) options.
  STROKE_STYLE_OPTIONS: [
    'black',
    'white',
    'grey',
    'red',
    'yellow',
    'blue',
    'green'
  ],
  // Canvas line width options.
  LINE_WIDTH_OPTIONS: [2, 4, 6, 8, 12, 16, 24, 32, 48, 64]
};

// Register constant.
ndnWhiteboardApp.constant('config', configConstant);
