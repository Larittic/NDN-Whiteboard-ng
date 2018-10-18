const canvasFactory = function() {
  return function(canvasElement) {
    this.width = canvasElement.width;
    this.height = canvasElement.height;
    this.context = canvasElement.getContext('2d');
    this.offsetLeft = canvasElement.offsetLeft;
    this.offsetTop = canvasElement.offsetTop;

    // All canvas updates in time order.
    this.updates = [];

    // Current draw state.
    this.draw = {
      strokeStyle: 'black',
      lineWidth: 2,
      drawing: false
    };

    // Current stroke points.
    this.stroke = [];

    // Last update.
    this.lastUpdate = {
      num: -1,
      time: -1,
      strokeStyle: 'black',
      lineWidth: 2,
      stroke: []
    };

    // Clears canvas content.
    this.clearContent = function() {
      this.updates = [];
      this.context.clearRect(0, 0, this.width, this.height);
    };

    // Inserts update into this.updates according to time order. Return the
    // insert index.
    this.insertUpdate = function(update) {
      let i = this.updates.length - 1;
      while (i >= 0) {
        if (this.updates[i].time <= update.time) break;
      }
      this.updates.splice(i + 1, 0, update);
      return i + 1;
    };

    // Applies a new content update.
    this.applyContentUpdate = function(update) {
      this.insertUpdate(update);
      this.drawStroke(update.stroke, update.lineWidth, update.strokeStyle);
      // TODO: reconcile according to insert index. e.g., different colors.
    };

    this.getLastUpdate = function() {
      if (this.lastUpdate.stroke.length === 0) return null;
      return this.lastUpdate;
    };

    this.mousedown = function(event) {
      const curPoint = this.getPoint(event);
      this.drawDot(curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.addStrokePoint(curPoint);
      this.draw.drawing = true;
    };

    this.mouseup = function() {
      this.draw.drawing = false;
      this.saveLastUpdateAndClearStroke();
    };

    this.mouseleave = function(event) {
      if (!this.draw.drawing) return;
      const curPoint = this.getPoint(event);
      const lastPoint = this.stroke[this.stroke.length - 1];
      this.drawLine(lastPoint, curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.drawDot(curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.addStrokePoint(curPoint);
      this.draw.drawing = false;
      this.saveLastUpdateAndClearStroke();
    };

    this.mousemove = function(event) {
      if (!this.draw.drawing) return;
      const curPoint = this.getPoint(event);
      const lastPoint = this.stroke[this.stroke.length - 1];
      this.drawLine(lastPoint, curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.drawDot(curPoint, this.draw.lineWidth, this.draw.strokeStyle);
      this.addStrokePoint(curPoint);
    };

    this.getPoint = function(event) {
      return {
        x: event.layerX - this.offsetLeft,
        y: event.layerY - this.offsetTop
      };
    };

    this.saveLastUpdateAndClearStroke = function() {
      // If the stroke is empty, return immediately.
      if (this.stroke.length === 0) return;
      this.lastUpdate.num++;
      this.lastUpdate.time = new Date().getTime();
      this.lastUpdate.strokeStyle = this.draw.strokeStyle;
      this.lastUpdate.lineWidth = this.draw.lineWidth;
      // Deep copy.
      this.lastUpdate.stroke = JSON.parse(JSON.stringify(this.stroke));
      this.insertUpdate(this.lastUpdate);
      this.clearStroke();
    };

    this.clearStroke = function() {
      this.stroke = [];
    };

    this.addStrokePoint = function(point) {
      this.stroke.push(point);
    };

    this.drawStroke = function(stroke, lineWidth, strokeStyle) {
      if (!stroke || stroke.length == 0) return;
      this.drawDot(stroke[0], lineWidth, strokeStyle);
      for (let i = 1; i < stroke.length; i++) {
        this.drawLine(stroke[i - 1], stroke[i], lineWidth, strokeStyle );
        this.drawDot(stroke[i], lineWidth, strokeStyle);
      }
    };

    this.drawDot = function(point, radius, fillStyle) {
      this.context.beginPath();
      this.context.arc(point.x, point.y, radius / 2, 0, 2 * Math.PI);
      this.context.fillStyle = fillStyle;
      this.context.fill();
    };

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
