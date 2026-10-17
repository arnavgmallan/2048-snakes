# 2048 Snakes

A touch friendly 2048 puzzle where every tile belongs to one of six snake species. Slide the board to combine tiles with the same number and species; the resulting tile doubles in value and keeps its species.

| Letter | Species |
| --- | --- |
| C | Cobra |
| T | Typan |
| M | Mumba |
| V | Viper |
| R | Rattle |
| K | Krait |

## Play

- Use the arrow keys on a keyboard or swipe on a touch screen. A matching pair starts each new game.
- Only tiles with both the same number and species can combine.
- Nearby species appear more often to make matches easier to find. Merge sounds can be switched off.
- Use **Undo** to roll back the last move, or **New game** to start over.

Scores and the current game are saved in the browser. The static site can be hosted with GitHub Pages using the included workflow. Open `index.html` to play locally, or serve the folder from a static web host to use it as an installable web app.

## GitHub Pages

Push this project to a GitHub repository named `2048-snakes` on the `main` branch. In **Settings → Pages**, choose **GitHub Actions** as the build source. The workflow publishes the site after each push to `main`.
