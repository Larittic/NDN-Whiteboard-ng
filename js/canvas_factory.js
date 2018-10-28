const canvasFactory = function(util) {
  // Returns a canvas object that can draw on canvasElement.
  return function(canvasElement) {
    // The canvas element properties.
    this.width = canvasElement.width;
    this.height = canvasElement.height;
    this.context = canvasElement.getContext('2d');
    this.offsetLeft = canvasElement.offsetLeft;
    this.offsetTop = canvasElement.offsetTop;

    // All canvas content updates in time order.
    this.contentUpdates = [];

    // Current draw state.
    this.draw = {
      strokeStyle: 'black',
      lineWidth: 2,
      drawing: false
    };

    // Current stroke points.
    this.stroke = [];

    // Last update.
    this.lastContentUpdate = {
      num: -1,
      time: -1,
      strokeStyle: 'black',
      lineWidth: 2,
      stroke: []
    };

    // Clears canvas content.
    this.clearContentUpdates = function() {
      this.contentUpdates = [];
      this.context.clearRect(0, 0, this.width, this.height);
    };

    // Sets canvas content. It first clears previous content, then applies the
    // input updates.
    this.setContentUpdates = function(updates) {
      this.clearContentUpdates();
      // Sort updates by time in ascending order.
      updates.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      this.contentUpdates = updates;
      // Draw the updates.
      for (let i = 0; i < updates.length; i++) {
        this.drawStroke(
          updates[i].stroke,
          updates[i].lineWidth,
          updates[i].strokeStyle
        );
      }
    };

    // Inserts [update] into [this.contentUpdates] according to ascending time order. Return the
    // insert index.
    this.insertContentUpdate = function(update) {
      let i = this.contentUpdates.length - 1;
      while (i >= 0) {
        if (this.contentUpdates[i].time <= update.time) break;
      }
      this.contentUpdates.splice(i + 1, 0, util.deepcopy(update));
      return i + 1;
    };

    // Applies a new content update.
    this.applyContentUpdate = function(update) {
      this.insertContentUpdate(update);
      this.drawStroke(update.stroke, update.lineWidth, update.strokeStyle);
      // TODO: reconcile according to insert index. e.g., different colors.
    };

    // Returns the last content update.
    this.getLastContentUpdate = function() {
      if (this.lastContentUpdate.stroke.length === 0) return null;
      return util.deepcopy(this.lastContentUpdate);
    };

    // Handles mousedown event.
    this.mousedown = function(event) {
      const curPoint = this.getPoint(event);
      this.drawDot(curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.addStrokePoint(curPoint);
      this.draw.drawing = true;
    };

    // Handles mouseup event.
    this.mouseup = function() {
      this.draw.drawing = false;
      this.saveLastUpdateAndClearStroke();
    };

    // Handles mouseleave event.
    this.mouseleave = function(event) {
      if (!this.draw.drawing) return;
      const curPoint = this.getPoint(event);
      const lastPoint = this.stroke[this.stroke.length - 1];
      this.drawLine(
        lastPoint,
        curPoint,
        this.draw.lineWidth,
        this.draw.strokeStyle
      );
      this.drawDot(curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.addStrokePoint(curPoint);
      this.draw.drawing = false;
      this.saveLastUpdateAndClearStroke();
    };

    // Handles mousemove event.
    this.mousemove = function(event) {
      if (!this.draw.drawing) return;
      const curPoint = this.getPoint(event);
      const lastPoint = this.stroke[this.stroke.length - 1];
      this.drawLine(
        lastPoint,
        curPoint,
        this.draw.lineWidth,
        this.draw.strokeStyle
      );
      this.drawDot(curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.addStrokePoint(curPoint);
    };

    // Returns the canvas point from mouse event.
    this.getPoint = function(event) {
      return {
        x: event.layerX - this.offsetLeft,
        y: event.layerY - this.offsetTop
      };
    };

    // Saves the last content update and clears stroke.
    this.saveLastUpdateAndClearStroke = function() {
      // If stroke is empty, return immediately.
      if (this.stroke.length === 0) return;
      // Set last content update properties.
      this.lastContentUpdate.num++;
      this.lastContentUpdate.time = new Date().getTime();
      this.lastContentUpdate.strokeStyle = this.draw.strokeStyle;
      this.lastContentUpdate.lineWidth = this.draw.lineWidth;
      this.lastContentUpdate.stroke = util.deepcopy(this.stroke);
      // Insert [this.lastContentUpdate] to [this.contentUpdates].
      this.insertContentUpdate(this.lastContentUpdate);
      this.clearStroke();
    };

    // Clears stroke.
    this.clearStroke = function() {
      this.stroke = [];
    };

    // Adds a canvas point to stroke.
    this.addStrokePoint = function(point) {
      this.stroke.push(point);
    };

    // Draws a stroke.
    this.drawStroke = function(stroke, lineWidth, strokeStyle) {
      if (!stroke || stroke.length == 0) return;
      this.drawDot(stroke[0], lineWidth, strokeStyle);
      for (let i = 1; i < stroke.length; i++) {
        this.drawLine(stroke[i - 1], stroke[i], lineWidth, strokeStyle);
        this.drawDot(stroke[i], lineWidth, strokeStyle);
      }
    };

    // Draws a dot.
    this.drawDot = function(point, radius, fillStyle) {
      this.context.beginPath();
      this.context.arc(point.x, point.y, radius / 2, 0, 2 * Math.PI);
      this.context.fillStyle = fillStyle;
      this.context.fill();
    };

    // Draws a line.
    this.drawLine = function(point1, point2, lineWidth, strokeStyle) {
      this.context.beginPath();
      this.context.moveTo(point1.x, point1.y);
      this.context.lineTo(point2.x, point2.y);
      this.context.lineWidth = lineWidth;
      this.context.strokeStyle = strokeStyle;
      this.context.stroke();
    };
  };
};

// Register factory.
ndnWhiteboardApp.factory('Canvas', canvasFactory);
