# Setup

## Backend (local testing)

1. Install Flask in your backend environment:
   ```
   pip install flask
   ```

2. Copy `local_server.py` into your backend folder (alongside `app.py`).

3. Run it:
   ```
   python local_server.py
   ```
   Listens on http://localhost:8000

---

## Frontend

1. Scaffold Vite + React in your empty frontend folder:
   ```
   npm create vite@latest . -- --template react
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Delete the generated `src/` contents (App.jsx, App.css, assets/, etc.)

4. Copy the `src/` folder from this zip into your project, replacing everything.

5. Create a `.env` file in the project root:
   ```
   VITE_API_URL=http://localhost:8000
   ```
   For production (Lambda), change this to your API Gateway URL — no other code changes needed.

6. Run the dev server:
   ```
   npm run dev
   ```
   Opens at http://localhost:5173

---

## Notes

- `avg_bought_price` is stored as negative in the DB; the frontend uses `Math.abs()` for display and calculator logic.
- Hypothetical rows persist per-session in `sessionStorage` (cleared when you close the tab).
- The "Sync Activities" button calls the backend once on page load automatically. The backend enforces the 4h cooldown and returns remaining time if too soon.
- To deploy to Netlify: `npm run build`, then deploy the `dist/` folder. Set `VITE_API_URL` as an environment variable in Netlify settings.
