import cssText from "./UIImageLoader.css?inline";

class UIImageLoader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.cache();
    this.bind();

    document.addEventListener("params-change", this.onParamsChange);
  }

  disconnectedCallback() {
    document.removeEventListener("params-change", this.onParamsChange);
  }

  render() {
    this.shadowRoot.innerHTML = `
    <style>${cssText}</style>

    <div class="card">
      <div class="row">
        <div class="title">Image</div>
        <button class="btn" id="btn">Load</button>
      </div>

      <input class="file" id="file" type="file" accept="image/*" />
      <canvas class="preview" id="cv"></canvas>
    </div>
  `;
  }

  cache() {
    this.$btn = this.shadowRoot.getElementById("btn");
    this.$file = this.shadowRoot.getElementById("file");
    this.$cv = this.shadowRoot.getElementById("cv");
    this.ctx = this.$cv.getContext("2d");

    this.params = { scanlines: 15 };
    this.sourceImg = null;

    this.onParamsChange = (e) => {
      this.params = { ...this.params, ...e.detail };
      this.renderFrame();
    };
  }

  bind() {
    this.$btn.addEventListener("click", () => this.$file.click());

    this.$file.addEventListener("change", () => {
      const file = this.$file.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          this.sourceImg = img;

          this.$cv.width = img.naturalWidth;
          this.$cv.height = img.naturalHeight;
          this.$cv.style.display = "block";

          this.renderFrame();
        };

        img.src = String(reader.result);
      };

      reader.readAsDataURL(file);
    });
  }

  drawScanlines() {
    const strength = (this.params.scanlines ?? 0) / 100;
    if (strength <= 0) return;

    const step = 5;
    const alpha = 0.5 * strength;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = "#000";

    for (let y = 0; y < this.$cv.height; y += step) {
      this.ctx.fillRect(0, y, this.$cv.width, 2.5);
    }

    this.ctx.restore();
  }

  drawNoise() {
    const strength = (this.params.noise ?? 0) / 100; // 0..1
    if (strength <= 0) return;

    const w = this.$cv.width;
    const h = this.$cv.height;

    const density = 0.1 * strength;
    const alpha = 0.5 * strength;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = "#fff";

    const count = Math.floor(w * h * density);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() * w) | 0;
      const y = (Math.random() * h) | 0;

      this.ctx.fillRect(x, y, 1, 1);
    }

    this.ctx.restore();
  }

  applyRgbShift() {
    const dx = Math.round(this.params.rgbShift ?? 0);
    if (!dx) return;

    const w = this.$cv.width;
    const h = this.$cv.height;

    //SRC.Data looks like [R, G, B, A,   R, G, B, A,   R, G, B, A, ...] for all pixels.
    const src = this.ctx.getImageData(0, 0, w, h);
    const srcData = src.data;

    // End Result copy
    const out = this.ctx.createImageData(w, h);
    const outData = out.data;

    // IDX -> Grabs x y, turns them into the byte of a pixel
    const idx = (x, y) => (y * w + x) * 4;
    //So it doesnt go out of border.
    const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        //target pixel
        const o = idx(x, y);

        // Grabbing R from the LEFT
        const xr = clamp(x - dx, 0, w - 1);
        const ir = idx(xr, y);

        // G
        const ig = o;

        // Grabbbing B from the RIGHT
        const xb = clamp(x + dx, 0, w - 1);
        const ib = idx(xb, y);

        outData[o + 0] = srcData[ir + 0]; // R
        outData[o + 1] = srcData[ig + 1]; // G
        outData[o + 2] = srcData[ib + 2]; // B
        outData[o + 3] = srcData[o + 3]; // A
      }
    }

    // Tossed to canvas
    this.ctx.putImageData(out, 0, 0);
  }

  applyDisplacementHorizontal() {
    const t = (this.params.displacement ?? 0) / 100;
    if (t <= 0) return;

    const w = this.$cv.width;
    const h = this.$cv.height;

    // How many slices
    const slices = Math.floor(2 + t * 18);
    // How many px we moving.
    const maxDx = Math.floor(5 + t * 120);
    //Slice height
    const minSliceH = 2;
    const maxSliceH = Math.floor(6 + t * 60);

    // Grab the image
    const img = this.ctx.getImageData(0, 0, w, h);
    const data = img.data;

    // Copy as before
    const out = new ImageData(new Uint8ClampedArray(data), w, h);
    const outData = out.data;

    const rowBytes = w * 4;

    for (let i = 0; i < slices; i++) {
      // Grabbing a slice height
      const sliceH = Math.floor(
        minSliceH + Math.random() * (maxSliceH - minSliceH + 1),
      );
      //Starter position for da slice
      const y0 = Math.floor(Math.random() * (h - sliceH));

      // Randomming a slice movement.
      const dx = Math.floor((Math.random() * 2 - 1) * maxDx);

      // Coping rows
      for (let y = 0; y < sliceH; y++) {
        const srcRowStart = (y0 + y) * rowBytes;
        const dstRowStart = srcRowStart;

        // We shift in it bytes
        const shiftBytes = dx * 4;

        if (shiftBytes === 0) continue;

        if (shiftBytes > 0) {
          //Toss it to the right, right is lose, left from prev pixels.
          //to human: out[x] = src[x - dx], copying like that [0 .. rowBytes-shiftBytes) -> [shiftBytes .. rowBytes)
          outData.set(
            data.subarray(srcRowStart, srcRowStart + (rowBytes - shiftBytes)),
            dstRowStart + shiftBytes,
          );
        } else {
          // To the left it goes.
          const sb = -shiftBytes;
          outData.set(
            data.subarray(srcRowStart + sb, srcRowStart + rowBytes),
            dstRowStart,
          );
        }
      }
    }

    this.ctx.putImageData(out, 0, 0);
  }

  applyDisplacementVertical() {
    const t = (this.params.displacement ?? 0) / 100;
    if (t <= 0) return;

    const w = this.$cv.width;
    const h = this.$cv.height;

    const slices = Math.floor(2 + t * 18);

    const maxDy = Math.floor(5 + t * 120);

    const minSliceW = 2;
    const maxSliceW = Math.floor(6 + t * 60);

    const img = this.ctx.getImageData(0, 0, w, h);
    const data = img.data;

    const out = new ImageData(new Uint8ClampedArray(data), w, h);
    const outData = out.data;

    const idx = (x, y) => (y * w + x) * 4;

    for (let i = 0; i < slices; i++) {
      const sliceW = Math.floor(
        minSliceW + Math.random() * (maxSliceW - minSliceW + 1),
      );

      const x0 = Math.floor(Math.random() * (w - sliceW));

      const dy = Math.floor((Math.random() * 2 - 1) * maxDy);
      if (dy === 0) continue;

      for (let x = x0; x < x0 + sliceW; x++) {
        if (dy > 0) {
          for (let y = dy; y < h; y++) {
            const src = idx(x, y - dy);
            const dst = idx(x, y);
            outData[dst] = data[src];
            outData[dst + 1] = data[src + 1];
            outData[dst + 2] = data[src + 2];
            outData[dst + 3] = data[src + 3];
          }
        } else {
          const up = -dy;
          for (let y = 0; y < h - up; y++) {
            const src = idx(x, y + up);
            const dst = idx(x, y);
            outData[dst] = data[src];
            outData[dst + 1] = data[src + 1];
            outData[dst + 2] = data[src + 2];
            outData[dst + 3] = data[src + 3];
          }
        }
      }
    }

    this.ctx.putImageData(out, 0, 0);
  }

  applyDisplacement() {
    const t = (this.params.displacement ?? 0) / 100;
    if (t <= 0) return;

    const w = this.$cv.width;
    const h = this.$cv.height;

    const squares = Math.floor(2 + t * 38);

    const maxDyDx = Math.floor(5 + t * 120);

    const minSquareHW = 2;
    const maxSquareHW = Math.floor(6 + t * 120);

    const img = this.ctx.getImageData(0, 0, w, h);
    const data = img.data;

    const out = new ImageData(new Uint8ClampedArray(data), w, h);
    const outData = out.data;

    const idx = (x, y) => (y * w + x) * 4;

    for (let i = 0; i < squares; i++) {
      const squareHW = Math.floor(
        minSquareHW + Math.random() * (maxSquareHW - minSquareHW + 1),
      );

      const x0 = Math.floor(Math.random() * (w - squareHW));
      const y0 = Math.floor(Math.random() * (h - squareHW));

      const dx = Math.floor((Math.random() * 2 - 1) * maxDyDx);
      const dy = Math.floor((Math.random() * 2 - 1) * maxDyDx);
      if (dx === 0 && dy === 0) continue;

      for (let y = y0; y < y0 + squareHW; y++) {
        for (let x = x0; x < x0 + squareHW; x++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

          const src = idx(x, y);
          const dst = idx(nx, ny);

          outData[dst] = data[src];
          outData[dst + 1] = data[src + 1];
          outData[dst + 2] = data[src + 2];
          outData[dst + 3] = data[src + 3];
        }
      }
    }

    this.ctx.putImageData(out, 0, 0);
  }

  renderFrame() {
    if (!this.sourceImg) return;

    this.ctx.clearRect(0, 0, this.$cv.width, this.$cv.height);
    this.ctx.drawImage(this.sourceImg, 0, 0);

    this.applyDisplacement();
    this.applyRgbShift();
    this.drawScanlines();
    this.drawNoise();
  }
}

customElements.define("ui-image-loader", UIImageLoader);
export {};
