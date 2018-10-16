const canvasFactory = function() {
  return function(canvasElement) {
    this.width = canvasElement.width;
    this.height = canvasElement.height;
    this.context = canvasElement.getContext('2d');
    this.offsetLeft = canvasElement.offsetLeft;
    this.offsetTop = canvasElement.offsetTop;

    this.draw = {
      strokeStyle: 'black',
      lineWidth: 2,
      drawing: false
    };

    this.stroke = [];

    this.lastUpdate = {
      num: -1
    };

    this.clearContent = function() {
      this.context.clearRect(0, 0, this.width, this.height);
    };

    this.applyContentUpdate = function(update) {
      const stroke = update.stroke;
      if (!stroke || stroke.length == 0) return;
      this.drawDot(stroke[0], update.lineWidth, update.strokeStyle);
      for (let i = 1; i < stroke.length; i++) {
        this.drawLine(
          stroke[i - 1],
          stroke[i],
          update.lineWidth,
          update.strokeStyle
        );
        this.drawDot(stroke[i], update.lineWidth, update.strokeStyle);
      }
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
      console.log ('mouseleave');
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
      this.lastUpdate.num++;
      this.lastUpdate.strokeStyle = this.draw.strokeStyle;
      this.lastUpdate.lineWidth = this.draw.lineWidth;
      // Deep copy.
      this.lastUpdate.stroke = JSON.parse(JSON.stringify(this.stroke));
      this.clearStroke();
    };

    this.clearStroke = function() {
      this.stroke = [];
    };

    this.addStrokePoint = function(point) {
      this.stroke.push(point);
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
