# NDN-Whiteboard-ng
A collaborative whiteboard web application based on [NDN-JS](https://github.com/named-data/ndn-js) and [AngularJS](https://angularjs.org/).

## Run the app
1. Download the source code and uncompress to the same folder.
2. Open [index.html](https://github.com/Larittic/NDN-Whiteboard-ng/blob/master/index.html) in browser. Tested on Chrome (Windows and Linux), Firefox (Windows and Linux), and Safari. Microsoft Edge and Chrome on IOS are known to not work with this app.

## Multicast vs Unicast for notification interests
The other branch, multicast-notification-interest, uses multicast for notification interets. Currently, the configuration of NFD at the default NFD host "memoria.ndn.ucla.edu" will broadcast interets with names that have a prefix of "/ndn/broadcast". It should be constantly updated in accordance to the universal multicast configuration of NFD.
