import "./components/UISlider.js";
import "./components/UIImageLoader.js";

const params = {
  intensity: 50,
  rgbShift: 8,
  scanlines: 15,
  noise: 8,
};

const panel = document.getElementById("params");

panel.addEventListener("change", (e) => {
  const slider = e.target;
  const { value } = e.detail;
  const key = slider.id;

  params[key] = value;

  console.log("Params updated:", params);

  document.dispatchEvent(
    new CustomEvent("params-change", {
      detail: { [key]: Number(value) },
    }),
  );
});

document.addEventListener("image-load", (e) => {
  console.log("Loaded image:", e.detail.file.name);
});
