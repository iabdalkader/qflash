import { createApp } from "./app";

window.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");
  if (root) {
    createApp(root);
  }
});
