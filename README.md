# HuggingFace's Starchat extension for VSCode

Experience the power of AI-enhanced coding with this Visual Studio Code extension. By utilizing the [Starchat API](https://api-inference.huggingface.co/models/HuggingFaceH4/starchat-beta) you can effortlessly generate code or receive natural language responses for your coding inquiries, all without leaving the editor.

Take your coding to the next level with AI-powered assistance! Unlock the ability to automatically generate fresh code, seek clarifications, obtain explanations, refactor existing code, identify bugs, and much more 🚀✨

<br>

<img src="examples/main.png" alt="Refactoring selected code using Starchat"/>

<br>

## Features
- 🖱️ Utilize context menu shortcuts by right-clicking on a code selection for seamless execution.
- 📚 Automatically generate code documentation for your projects.
- 🔍 Obtain explanations for selected code segments.
- 🔧 Refactor or optimize code effortlessly.
- 🐛 Identify and address issues within your code.
- 🖥️ Access Starchat's responses conveniently in a panel adjacent to the editor.
- 🚀 Experience real-time generation of responses, witnessing them as they unfold.
- 📝 Seamlessly insert code snippets from the AI's response into the active editor by simply clicking on them.

## Setup

To utilize this extension, begin by installing it from the VSCode marketplace. Once the installation is finished, you'll need to incorporate your HuggingFace user access token into the extension settings in VSCode. Follow these steps to do so:

1. Open the Settings panel by navigating to the File menu and selecting `Preferences`, then `Settings`.
2. Use the search bar to filter the settings list by typing `Starchat`.
3. Locate the Starchat section and enter your API key into the designated field.

After completing these steps, the extension will be ready for use.

### Obtaining API key

To use this extension, you will need a user access token from HuggingFace. To obtain one, follow these steps:

1. Visit [HuggingFace's website](https://huggingface.co/settings/tokens). If you don't have an account, you will need to create one.
2. Click on the `New token` button to generate a new token.
3. Copy the token and paste it into the `API Key` field in the extension settings.

---

Please note that this extension is currently a proof of concept and may have some limitations or bugs. We welcome feedback and contributions to improve the extension.


## Notes

- The extension makes use of [HuggingFace Inference API](https://www.npmjs.com/package/@huggingface/inference) to work with HuggingFace inference endpoints.
- This project is compiled in Node.js v16 and leverages on [node-fetch-polyfill](https://www.npmjs.com/package/node-fetch-polyfill) to enable fetch method on older Node.js version.