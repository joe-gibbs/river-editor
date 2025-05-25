class RiverEditor {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.imageData = null;
    this.originalImageData = null;

    // Editor state
    this.currentTool = "river";
    this.isDrawing = false;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;

    // Drawing state for cardinal connections
    this.lastDrawX = null;
    this.lastDrawY = null;
    this.drawingStartX = null;
    this.drawingStartY = null;
    this.drawnPixels = new Set(); // Track pixels drawn in current stroke

    // History for undo/redo
    this.history = [];
    this.historyStep = -1;
    this.maxHistorySteps = 50;

    // Tool colors
    this.toolColors = {
      river: { r: 0, g: 0, b: 255 },
      source: { r: 0, g: 255, b: 0 },
      junction: { r: 255, g: 0, b: 0 },
      eraser: { r: 0, g: 0, b: 0 },
    };

    // Reference image element
    this.referenceImageElement = document.getElementById("referenceImage");
    this.referenceImageElement.style.opacity = 0.5;

    this.initializeEventListeners();
    this.updateCanvasSize();
  }

  initializeEventListeners() {
    // File input
    document
      .getElementById("fileInput")
      .addEventListener("change", (e) => this.loadImage(e));
    document
      .getElementById("saveBtn")
      .addEventListener("click", () => this.saveBMP());

    // Reference image input
    document
      .getElementById("refInput")
      .addEventListener("change", (e) => this.loadReferenceImage(e));

    // Reference image opacity slider
    document.getElementById("refOpacity").addEventListener("input", (e) => {
      this.referenceImageElement.style.opacity = e.target.value / 100;
    });

    // Tool selection
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".tool-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentTool = btn.dataset.tool;
      });
    });

    // View controls
    document
      .getElementById("zoomIn")
      .addEventListener("click", () => this.changeZoom(1.25));
    document
      .getElementById("zoomOut")
      .addEventListener("click", () => this.changeZoom(0.8));
    document
      .getElementById("resetView")
      .addEventListener("click", () => this.resetView());

    // Action controls
    document
      .getElementById("undoBtn")
      .addEventListener("click", () => this.undo());
    document
      .getElementById("redoBtn")
      .addEventListener("click", () => this.redo());
    document
      .getElementById("clearBtn")
      .addEventListener("click", () => this.clearCanvas());

    // Canvas events
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseleave", () => this.stopDrawing());
    this.canvas.addEventListener("wheel", (e) => this.handleWheel(e));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          this.redo();
        } else if (e.key === "s") {
          e.preventDefault();
          this.saveBMP();
        }
      }
    });

    // Window resize
    window.addEventListener("resize", () => this.updateCanvasSize());
  }

  loadImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        this.imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        this.originalImageData = this.ctx.getImageData(
          0,
          0,
          img.width,
          img.height
        );

        // Initialize history
        this.history = [this.ctx.getImageData(0, 0, img.width, img.height)];
        this.historyStep = 0;

        // Update UI
        document.getElementById("saveBtn").disabled = false;
        document.getElementById(
          "imageSize"
        ).textContent = `${img.width}x${img.height}`;
        this.updateHistoryButtons();

        this.resetView();
        this.render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Load an external reference image (PNG/JPG/etc) and overlay it above the canvas
   */
  loadReferenceImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      // Set source for overlay <img>
      this.referenceImageElement.src = e.target.result;

      // Once the image data is available, ensure it matches the canvas size
      this.referenceImageElement.onload = () => {
        // If a canvas image is already loaded, match its dimensions for pixel-perfect tracing
        if (this.canvas.width && this.canvas.height) {
          this.referenceImageElement.width = this.canvas.width;
          this.referenceImageElement.height = this.canvas.height;
        } else {
          // Fallback to the natural size of the reference image
          this.referenceImageElement.width =
            this.referenceImageElement.naturalWidth;
          this.referenceImageElement.height =
            this.referenceImageElement.naturalHeight;
        }

        // Ensure the transform is in sync
        this.render();
      };
    };
    reader.readAsDataURL(file);
  }

  saveBMP() {
    if (!this.imageData) return;

    // Create BMP file
    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height);

    // BMP Header
    const fileHeaderSize = 14;
    const infoHeaderSize = 40;
    const bytesPerPixel = 3;
    const rowSize = Math.floor((bytesPerPixel * width + 3) / 4) * 4;
    const pixelDataSize = rowSize * height;
    const fileSize = fileHeaderSize + infoHeaderSize + pixelDataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // File header
    view.setUint16(0, 0x4d42, false); // 'BM'
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true);
    view.setUint32(10, fileHeaderSize + infoHeaderSize, true);

    // Info header
    view.setUint32(14, infoHeaderSize, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, bytesPerPixel * 8, true);
    view.setUint32(30, 0, true);
    view.setUint32(34, pixelDataSize, true);
    view.setInt32(38, 2835, true); // 72 DPI
    view.setInt32(42, 2835, true); // 72 DPI
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // Pixel data (BMP stores bottom-to-top)
    let offset = fileHeaderSize + infoHeaderSize;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        view.setUint8(offset++, imageData.data[i + 2]); // B
        view.setUint8(offset++, imageData.data[i + 1]); // G
        view.setUint8(offset++, imageData.data[i]); // R
      }
      // Padding
      for (let p = bytesPerPixel * width; p < rowSize; p++) {
        view.setUint8(offset++, 0);
      }
    }

    // Download
    const blob = new Blob([buffer], { type: "image/bmp" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "river_texture.bmp";
    a.click();
    URL.revokeObjectURL(url);
  }

  startDrawing(e) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle mouse or Shift+Left for panning
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
    } else if (e.button === 0) {
      // Left mouse for drawing
      this.isDrawing = true;
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / this.zoom);
      const y = Math.floor((e.clientY - rect.top) / this.zoom);
      this.lastDrawX = x;
      this.lastDrawY = y;
      this.drawingStartX = x;
      this.drawingStartY = y;
      this.drawnPixels.clear(); // Clear the set for new stroke
      this.draw(e);
    }
  }

  draw(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.zoom;
    const y = (e.clientY - rect.top) / this.zoom;

    // Update mouse position display
    if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
      document.getElementById("mousePos").textContent = `${Math.floor(
        x
      )}, ${Math.floor(y)}`;
    } else {
      document.getElementById("mousePos").textContent = "-";
    }

    if (this.isPanning) {
      this.panX += e.clientX - this.lastPanX;
      this.panY += e.clientY - this.lastPanY;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.render();
    } else if (this.isDrawing && this.imageData) {
      const currentX = Math.floor(x);
      const currentY = Math.floor(y);

      // Draw cardinal line from last position to current position
      if (this.lastDrawX !== null && this.lastDrawY !== null) {
        this.drawCardinalLine(
          this.lastDrawX,
          this.lastDrawY,
          currentX,
          currentY
        );
      } else {
        // First point
        this.drawPixel(currentX, currentY);
        // Update network for single pixel
        if (this.currentTool === "river") {
          this.updateRiverNetworkInArea(
            currentX - 1,
            currentY - 1,
            currentX + 1,
            currentY + 1
          );
        }
      }

      this.lastDrawX = currentX;
      this.lastDrawY = currentY;
    }
  }

  stopDrawing() {
    if (this.isDrawing && this.imageData) {
      // Check if the last pixel should be a junction
      if (
        this.currentTool === "river" &&
        this.lastDrawX !== null &&
        this.lastDrawY !== null
      ) {
        this.checkForJunction(this.lastDrawX, this.lastDrawY);
      }
      this.saveToHistory();
    }
    this.isDrawing = false;
    this.isPanning = false;
    this.canvas.style.cursor = "crosshair";
    this.lastDrawX = null;
    this.lastDrawY = null;
    this.drawingStartX = null;
    this.drawingStartY = null;
    this.drawnPixels.clear();
  }

  drawPixel(centerX, centerY) {
    const color = this.toolColors[this.currentTool];

    if (
      centerX >= 0 &&
      centerX < this.canvas.width &&
      centerY >= 0 &&
      centerY < this.canvas.height
    ) {
      const index = (centerY * this.canvas.width + centerX) * 4;
      this.imageData.data[index] = color.r;
      this.imageData.data[index + 1] = color.g;
      this.imageData.data[index + 2] = color.b;
      this.imageData.data[index + 3] = 255;

      // Track this pixel as drawn in current stroke
      if (this.currentTool === "river") {
        this.drawnPixels.add(`${centerX},${centerY}`);
      }
    }

    // Don't update network here anymore - it's handled in drawCardinalLine
    this.ctx.putImageData(this.imageData, 0, 0);
    this.render();
  }

  drawCardinalLine(x1, y1, x2, y2) {
    // Draw a line that only moves cardinally (horizontally or vertically)
    // This creates an L-shaped path if the points aren't aligned

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    if (dx === 0 && dy === 0) {
      // Same point
      this.drawPixel(x1, y1);
      return;
    }

    // Decide whether to go horizontal-first or vertical-first based on distance
    // This creates more natural drawing behavior
    if (dx >= dy) {
      // Horizontal first, then vertical
      this.drawHorizontalLine(x1, y1, x2, y1);
      this.drawVerticalLine(x2, y1, x2, y2);
    } else {
      // Vertical first, then horizontal
      this.drawVerticalLine(x1, y1, x1, y2);
      this.drawHorizontalLine(x1, y2, x2, y2);
    }

    // Update the river network in the affected area
    if (this.currentTool === "river") {
      const minX = Math.min(x1, x2) - 1;
      const maxX = Math.max(x1, x2) + 1;
      const minY = Math.min(y1, y2) - 1;
      const maxY = Math.max(y1, y2) + 1;
      this.updateRiverNetworkInArea(minX, minY, maxX, maxY);
    }
  }

  drawHorizontalLine(x1, y, x2, y2) {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    for (let x = startX; x <= endX; x++) {
      this.drawPixel(x, y);
    }
  }

  drawVerticalLine(x, y1, x2, y2) {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    for (let y = startY; y <= endY; y++) {
      this.drawPixel(x, y);
    }
  }

  checkForJunction(x, y) {
    // Check if this pixel connects to any existing river pixels that weren't drawn in this stroke
    const hasExistingNeighbor =
      (this.isRiverPixel(x - 1, y) && !this.drawnPixels.has(`${x - 1},${y}`)) ||
      (this.isRiverPixel(x + 1, y) && !this.drawnPixels.has(`${x + 1},${y}`)) ||
      (this.isRiverPixel(x, y - 1) && !this.drawnPixels.has(`${x},${y - 1}`)) ||
      (this.isRiverPixel(x, y + 1) && !this.drawnPixels.has(`${x},${y + 1}`));

    if (hasExistingNeighbor) {
      // Mark this pixel as a junction
      const index = (y * this.canvas.width + x) * 4;
      this.imageData.data[index] = 255; // Red
      this.imageData.data[index + 1] = 0;
      this.imageData.data[index + 2] = 0;
      this.imageData.data[index + 3] = 255;
      this.ctx.putImageData(this.imageData, 0, 0);
    }
  }

  changeZoom(factor) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.1, Math.min(10, this.zoom * factor));

    // Adjust pan to keep center point stable
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    this.panX = centerX - (centerX - this.panX) * (this.zoom / oldZoom);
    this.panY = centerY - (centerY - this.panY) * (this.zoom / oldZoom);

    document.getElementById("zoomLevel").textContent =
      Math.round(this.zoom * 100) + "%";
    this.render();
  }

  resetView() {
    const container = document.querySelector(".canvas-container");
    const containerRect = container.getBoundingClientRect();

    if (this.canvas.width && this.canvas.height) {
      // Calculate zoom to fit the image in the viewport with some padding
      const padding = 40; // pixels of padding around the image
      const scaleX = (containerRect.width - padding * 2) / this.canvas.width;
      const scaleY = (containerRect.height - padding * 2) / this.canvas.height;
      this.zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

      // Center the image in the viewport
      this.panX = (containerRect.width - this.canvas.width * this.zoom) / 2;
      this.panY = (containerRect.height - this.canvas.height * this.zoom) / 2;
    } else {
      // Default values if no image is loaded
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    }

    document.getElementById("zoomLevel").textContent =
      Math.round(this.zoom * 100) + "%";
    this.render();
  }

  handleWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the point on the canvas under the mouse before zoom
    const canvasX = mouseX / this.zoom;
    const canvasY = mouseY / this.zoom;

    // Apply zoom
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.1, Math.min(10, this.zoom * factor));

    // Calculate new mouse position after zoom
    const newMouseX = canvasX * this.zoom;
    const newMouseY = canvasY * this.zoom;

    // Adjust pan to keep the same point under the mouse
    this.panX += mouseX - newMouseX;
    this.panY += mouseY - newMouseY;

    document.getElementById("zoomLevel").textContent =
      Math.round(this.zoom * 100) + "%";
    this.render();
  }

  clearCanvas() {
    if (
      !this.imageData ||
      !confirm("Clear all drawings? This cannot be undone.")
    )
      return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.imageData = this.ctx.createImageData(width, height);

    // Fill with black
    for (let i = 0; i < this.imageData.data.length; i += 4) {
      this.imageData.data[i] = 0;
      this.imageData.data[i + 1] = 0;
      this.imageData.data[i + 2] = 0;
      this.imageData.data[i + 3] = 255;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.saveToHistory();
    this.render();
  }

  saveToHistory() {
    // Remove any states after current step
    this.history = this.history.slice(0, this.historyStep + 1);

    // Add new state
    this.history.push(
      this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    );

    // Limit history size
    if (this.history.length > this.maxHistorySteps) {
      this.history.shift();
    } else {
      this.historyStep++;
    }

    this.updateHistoryButtons();
  }

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      const state = this.history[this.historyStep];
      this.ctx.putImageData(state, 0, 0);
      this.imageData = state;
      this.updateHistoryButtons();
      this.render();
    }
  }

  redo() {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      const state = this.history[this.historyStep];
      this.ctx.putImageData(state, 0, 0);
      this.imageData = state;
      this.updateHistoryButtons();
      this.render();
    }
  }

  updateHistoryButtons() {
    document.getElementById("undoBtn").disabled = this.historyStep <= 0;
    document.getElementById("redoBtn").disabled =
      this.historyStep >= this.history.length - 1;
  }

  updateCanvasSize() {
    const container = document.querySelector(".canvas-container");
    const rect = container.getBoundingClientRect();

    // Don't stretch the canvas - let CSS transform handle the sizing
    // Remove these lines that were stretching the canvas
    // this.canvas.style.width = rect.width + "px";
    // this.canvas.style.height = rect.height + "px";
  }

  render() {
    // Always update transforms so that reference stays in sync
    const transformStr = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;

    // Canvas transform (only if we have an image loaded)
    if (this.imageData) {
      this.canvas.style.transform = transformStr;
      this.canvas.style.transformOrigin = "0 0";
    }

    // Apply the same transform to the reference overlay if it has a source
    if (this.referenceImageElement && this.referenceImageElement.src) {
      this.referenceImageElement.style.transform = transformStr;
      this.referenceImageElement.style.transformOrigin = "0 0";
    }
  }

  isRiverPixel(x, y) {
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
      return false;
    }
    const index = (y * this.canvas.width + x) * 4;
    // Check if it's any river-related color (blue, green, or red)
    return (
      this.imageData.data[index + 2] === 255 || // Blue (river)
      this.imageData.data[index + 1] === 255 || // Green (source)
      this.imageData.data[index] === 255 // Red (junction)
    );
  }

  countCardinalNeighbors(x, y) {
    let count = 0;
    // Check cardinal directions (up, down, left, right)
    if (this.isRiverPixel(x, y - 1)) count++; // up
    if (this.isRiverPixel(x, y + 1)) count++; // down
    if (this.isRiverPixel(x - 1, y)) count++; // left
    if (this.isRiverPixel(x + 1, y)) count++; // right
    return count;
  }

  updateRiverNetwork() {
    // Update the entire network - useful after loading an image or clearing
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Analyze each river pixel and update its type based on connections
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isRiverPixel(x, y)) {
          const neighbors = this.countCardinalNeighbors(x, y);
          const index = (y * width + x) * 4;

          // Determine what type this pixel should be
          if (neighbors === 0 || neighbors === 1) {
            // Dead end or single connection = source (green)
            this.imageData.data[index] = 0;
            this.imageData.data[index + 1] = 255;
            this.imageData.data[index + 2] = 0;
          } else if (neighbors >= 3) {
            // Three or more connections = junction (red)
            this.imageData.data[index] = 255;
            this.imageData.data[index + 1] = 0;
            this.imageData.data[index + 2] = 0;
          } else {
            // Two connections = regular river (blue)
            this.imageData.data[index] = 0;
            this.imageData.data[index + 1] = 0;
            this.imageData.data[index + 2] = 255;
          }
        }
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.render();
  }

  updateRiverNetworkInArea(minX, minY, maxX, maxY) {
    // Clamp bounds to canvas
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(this.canvas.width - 1, maxX);
    maxY = Math.min(this.canvas.height - 1, maxY);

    // Analyze each river pixel in the area and update its type based on connections
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.isRiverPixel(x, y)) {
          const neighbors = this.countCardinalNeighbors(x, y);
          const index = (y * this.canvas.width + x) * 4;

          // Check if this is the drawing start point
          const isDrawingStart =
            x === this.drawingStartX && y === this.drawingStartY;

          // Only update sources and regular rivers, not junctions
          // Junctions are now handled separately when drawing ends
          if (neighbors === 0 || (neighbors === 1 && isDrawingStart)) {
            // Isolated pixel or start of a new river = source (green)
            this.imageData.data[index] = 0;
            this.imageData.data[index + 1] = 255;
            this.imageData.data[index + 2] = 0;
          } else if (this.imageData.data[index] !== 255) {
            // Not a junction (red) - make it regular river (blue)
            this.imageData.data[index] = 0;
            this.imageData.data[index + 1] = 0;
            this.imageData.data[index + 2] = 255;
          }
        }
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }
}

// Initialize the editor when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new RiverEditor();
});
