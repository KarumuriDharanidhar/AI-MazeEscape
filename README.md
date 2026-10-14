# AI Maze Escape — Browser Edition

A browser-playable conversion of the Python/Pygame AI Maze Escape game. It uses HTML, CSS, JavaScript, and the Canvas API. No server or build step is needed.

## Features
- Random maze generation using depth-first search (DFS)
- Keyboard controls (WASD / arrow keys)
- AI hunter that chases the player using breadth-first search (BFS)
- Key and exit objective
- Multiple levels, lives, score, time bonus, and best score saved in browser local storage
- Optional shortest-route hint (costs 25 points)
- Responsive neon-themed interface and optional synthesized sound effects

## Test locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser, or use VS Code with the Live Server extension.
3. Click **START GAME**.

## Deploy with GitHub Pages
1. Create a **public** repository named `ai-maze-escape` at https://github.com/new .
2. Upload `index.html`, `style.css`, and `script.js` to the repository root and commit the files.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`, then click **Save**.
6. Wait for deployment to finish. The site URL will look like:
   `https://YOUR-GITHUB-USERNAME.github.io/ai-maze-escape/`

GitHub Pages documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Controls
- `W A S D` or arrow keys: move
- `SPACE`: show AI route hint (25 points)
- `ESC`: pause/resume
- Use the on-screen buttons for pause, sound, hints, and a new maze

## Notes
- This browser version is separate from the Python/Pygame version; it does not replace `main.py`.
- The best score is stored in local storage in the browser on the device where you play.
- Google Fonts are used when online; system fonts are used as fallbacks.
