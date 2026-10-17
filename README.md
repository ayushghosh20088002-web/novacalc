# NovaCalc — All-in-One Calculator

A responsive calculator website made with plain HTML, CSS, and JavaScript. No build tools or external libraries are required.

## Features
- Basic arithmetic with parentheses and operator precedence
- Scientific functions: square root, powers, trigonometry, inverse trigonometry, logarithms, factorial, absolute value, rounding and exponentials
- Degrees/radians toggle
- Calculation history for the current page session
- Unit conversion for length, mass/weight and temperature
- Percentage, discount, percentage-change and ratio tools
- Dark/light theme switch
- Keyboard support, responsive layout and accessible labels
- Safe arithmetic parser (does not use `eval()` or `Function()`)

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser.
3. If your browser restricts local files, run a local static server from this folder:
   - With Python installed, open a terminal in the folder and run `python -m http.server 8000`
   - Visit `http://localhost:8000`

## Publish with GitHub Pages (free)
1. Sign in at https://github.com/.
2. Create a new **public** repository, for example `novacalc`.
3. Upload `index.html`, `style.css`, and `script.js` to the repository root. You can also upload this README.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Select branch `main` and folder `/(root)`, then click **Save**.
7. Wait for deployment and open the URL shown on the Pages settings screen. It will usually look like `https://YOUR-USERNAME.github.io/novacalc/`.

## Notes
- This is a static website, so GitHub Pages can host it directly.
- Calculation history is intentionally kept in memory only and resets when the page is reloaded.
- Trigonometric functions use the selected DEG or RAD mode. Inverse trig functions return results in that same angle mode.
- The ratio tool rounds input values to six decimal places before simplifying.
- Test edge cases (division by zero, invalid logarithm/square root, and temperatures below absolute zero) before sharing widely.
