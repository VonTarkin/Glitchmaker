import "./components/UISlider.js";

const intensity = document.getElementById("intensity");

intensity.addEventListener("change", (e) => {
  console.log("Intensity:", e.detail.value);
});
