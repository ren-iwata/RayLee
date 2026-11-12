import { Game } from "./game.js";

window.addEventListener("load", () => {
  Game.init().catch((err) => {
    console.error("RayLee init failed", err);
  });
});
