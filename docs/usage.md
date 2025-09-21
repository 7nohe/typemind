# Using the Typemind Chrome Extension

These steps explain how to prepare Google Chrome so the extension can call Chrome's built-in AI (Gemini Nano) APIs. Instructions are current as of September 21, 2025.

## 1. Install a Supported Chrome Build
- Use Chrome Canary or Chrome Dev version 131 or later. Built-in AI APIs are still experimental and roll out to stable after Chrome 138, so pre-release channels are the most reliable way to access them. 

## 2. Enable Required Chrome Flags
1. Open the target browser and visit `chrome://flags`.
2. Search for each flag below and set it to *Enabled* (or the noted value):
   - `#prompt-api-for-gemini-nano` → *Enabled*.
   - `#optimization-guide-on-device-model` → *Enabled (BypassPrefRequirement)*.
3. Relaunch Chrome when prompted so the changes take effect. 

Optional APIs. If you plan to experiment with other Chrome AI surfaces (translation, summarization, rewrite, etc.), enable the additional flags listed in Step 2 of the Chrome AI Playground guide. 
## 3. Verify the On-Device Model Download
1. Navigate to `chrome://components`.
2. Locate **Optimization Guide On Device Model** and confirm the version is not `0.0.0.0`.
3. If necessary, click **Check for update** to force the Gemini Nano model download before running the extension. 

## 4. Sign in and Restart (If Needed)
- Ensure you are signed into Chrome with a Google account; Guest and Incognito sessions cannot use the built-in AI model.
- After enabling flags or downloading updates, restart Chrome so the model loads cleanly.

## 5. Confirm API Availability
- Open the DevTools console and run:
  ```js
  await chrome.ai.languageModel.availability();
  ```
  Expect a status of `"available"` or `"downloadable"`. A `"downloadable"` response means the browser still needs user activation to finish fetching the model.

## 6. Load the Extension
1. Run `npm install && npm run build` in the project root to generate the MV3 bundle.
2. Visit `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the `dist/` directory created by the build step.

After loading, open a supported text area (e.g., Google Docs, Notion). Once the model reports `available`, the extension can request completions using Chrome’s on-device AI.

## Troubleshooting Tips
- If `availability()` returns `"unavailable"`, verify the browser channel, flag settings, and that the device meets Chrome’s requirements (disk space, power).
- Re-run **Check for update** under `chrome://components` if the model version reverts after a browser update.
- Keep Chrome Canary updated; experimental flags can reset with new builds.
