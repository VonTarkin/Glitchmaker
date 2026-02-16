import cssText from "./UISlider.css?inline";

class UISlider extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static get observedAttributes() {
    return ["label", "min", "max", "value", "unit"];
  }

  connectedCallback() {
    this.render();
    this.cache();
    this.bind();
    this.syncUIFromAttrs();
  }

  attributeChangedCallback() {
    if (this.$rng) {
      this.syncUIFromAttrs();
    }
  }

  get value() {
    return Number(this.getAttribute("value") ?? 0);
  }

  set value(v) {
    this.setAttribute("value", String(v));
  }

  render() {
    this.shadowRoot.innerHTML = `
    <style>${cssText}</style>

    <div class="card">
      <div class="top">
        <div class="label" id="label"></div>
        <div class="val"><span id="val"></span><span id="unit"></span></div>
      </div>

      <input class="range" id="rng" type="range" />
    </div>
  `;
  }

  cache() {
    this.$rng = this.shadowRoot.getElementById("rng");
    this.$label = this.shadowRoot.getElementById("label");
    this.$val = this.shadowRoot.getElementById("val");
    this.$unit = this.shadowRoot.getElementById("unit");
  }

  bind() {
    this.$rng.addEventListener("input", () => {
      this.value = this.$rng.value;
      this.updateValueLabel();

      this.dispatchEvent(
        new CustomEvent("change", {
          detail: { value: this.value },
          bubbles: true,
        }),
      );
    });
  }

  syncUIFromAttrs() {
    const min = this.getAttribute("min") ?? "0";
    const max = this.getAttribute("max") ?? "100";
    const value = this.getAttribute("value") ?? "0";
    const label = this.getAttribute("label") ?? "";
    const unit = this.getAttribute("unit") ?? "";

    this.$rng.min = min;
    this.$rng.max = max;
    this.$rng.value = value;

    this.$label.textContent = label;
    this.$unit.textContent = unit;

    this.updateValueLabel();
  }

  updateValueLabel() {
    this.$val.textContent = String(this.value);
  }
}

customElements.define("ui-slider", UISlider);
export {};
