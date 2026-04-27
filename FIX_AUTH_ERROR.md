# Fixing "Firebase Admin SDK failed to initialize"

If you see a `SyntaxError` in your build logs or a "Server Configuration Error" alert on the User Management page, it means the `GOOGLE_APPLICATION_CREDENTIALS_JSON` environment variable is not formatted correctly. 

Environment managers (like Vercel or Firebase App Hosting) often have trouble with multi-line JSON files.

## Step-by-Step Fix (The "One-Line" Method)

### 1. Generate a Clean JSON Key
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **studio-7521332906-59af2**.
3. Click the **Gear icon (Project Settings)** > **Service Accounts**.
4. Click **Generate new private key** at the bottom.
5. Save the file as `serviceAccount.json` in your project's root folder.

### 2. Generate the Flattened String
Open your terminal in the project folder and run:
```bash
node generateEnvVar.js
```
The script will output a single, extremely long line of text. This is a "flattened" version of your JSON.

### 3. Update Your Hosting Secret
1. Go to your **App Hosting dashboard** (or the GCP Secret Manager).
2. Find the secret named `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
3. Paste the **entire flattened string** from Step 2 as the new value.
4. **Important:** Ensure there are no leading or trailing spaces or quotes around the string when you paste it.

### 4. Verify & Deploy
1. Save the secret.
2. Trigger a new deployment of your app.
3. Once deployed, visit the **Admin > User Management** page. If the table loads, the fix is successful!

---

## Still having issues?
The new initialization logic in `src/lib/firebase-admin.ts` now automatically detects and cleans common issues, but it still requires a string that is fundamentally valid JSON. If you see character-specific errors (like "position 4"), it almost always means there is a hidden character or missing brace at the very start of your environment variable.
