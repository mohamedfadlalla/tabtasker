# TabTasker

TabTasker is an intelligent Chrome extension that automatically organizes your tabs into meaningful groups based on user-defined projects and categories. Built for the Google Chrome Built-in AI Challenge, it leverages Gemini Nano for completely private, on-device tab classification.

## Key Features

- Automatic tab grouping based on content and context
- Full privacy: Uses on-device Gemini Nano model - no cloud processing
- User-defined projects and categories
- Real-time tab organization
- Zero latency performance

## Prerequisites

1. Set up Gemini Nano in Chrome by following the instructions at:
   https://docs.google.com/document/d/1VG8HIyz361zGduWgNG7R_R8Xkv0OOJ8b5C9QKeCjU0c/edit?tab=t.0

2. Disable the text safety classifier flag:
   - Navigate to `chrome://flags/#text-safety-classifier`
   - Set to "Disabled"

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome Canary:
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the built extension directory

## Demo

Watch TabTasker in action: [Video Demo](https://youtu.be/TDl2vk9Z5eQ)

## Privacy

TabTasker processes everything locally using Chrome's built-in Gemini Nano model. No data is sent to external servers, ensuring complete privacy of your browsing data.

## License

Apache License Version 2.0

## Contributors

Developed by Mohamed Fadlalla