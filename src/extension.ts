import * as vscode from 'vscode';
import { HfInference } from '@huggingface/inference';
const fetch = require('node-fetch-polyfill');


type AuthInfo = { apiKey?: string };
type Settings = { 
	apiUrl?: string,
	maxNewTokens?: number,
	temperature?: number,
	topK?: number,
	topP?: number
};


const BASE_URL = 'https://api-inference.huggingface.co/models/HuggingFaceH4/starchat-beta';


export function activate(context: vscode.ExtensionContext) {

	console.log('activating extension "chatgpt"');
	// Get the settings from the extension's configuration
	const config = vscode.workspace.getConfiguration('starchat');

	// Create a new TextGenerationViewProvider instance and register it with the extension's context
	const provider = new TextGenerationViewProvider(context.extensionUri);

	// Put configuration settings into the provider
	provider.setAuthenticationInfo({
		apiKey: config.get('apiKey')
	});
	provider.setSettings({
		apiUrl: config.get('apiUrl') || BASE_URL,
		maxNewTokens: config.get('maxNewTokens') || 1024,
		temperature: config.get('temperature') || 0.2,
		topK: config.get('topK') || 50,
		topP: config.get('topP') || 0.95
	});

	// Register the provider with the extension's context
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(TextGenerationViewProvider.viewType, provider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);

	const commandHandler = (command: string) => {
		const config = vscode.workspace.getConfiguration('starchat');
		const prompt = config.get(command) as string;
		provider.search(prompt);
	};

	// Register the commands that can be called from the extension's package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('chatgpt.explain', () => commandHandler('promptPrefix.explain')),
		vscode.commands.registerCommand('chatgpt.refactor', () => commandHandler('promptPrefix.refactor')),
		vscode.commands.registerCommand('chatgpt.optimize', () => commandHandler('promptPrefix.optimize')),
		vscode.commands.registerCommand('chatgpt.findProblems', () => commandHandler('promptPrefix.findProblems')),
		vscode.commands.registerCommand('chatgpt.documentation', () => commandHandler('promptPrefix.documentation')),
	);

	// Change the extension's session token or settings when configuration is changed
	vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
		if (event.affectsConfiguration('starchat.apiKey')) {
			const config = vscode.workspace.getConfiguration('starchat');
			provider.setAuthenticationInfo({ apiKey: config.get('apiKey') });
		} else if (event.affectsConfiguration('starchat.apiUrl')) {
			const config = vscode.workspace.getConfiguration('starchat');
			let url = config.get('apiUrl') as string || BASE_URL;
			provider.setSettings({ apiUrl: url });
		} else if (event.affectsConfiguration('starchat.maxNewTokens')) {
			const config = vscode.workspace.getConfiguration('starchat');
			provider.setSettings({ maxNewTokens: config.get('maxNewTokens') });
		} else if (event.affectsConfiguration('starchat.temperature')) {
			const config = vscode.workspace.getConfiguration('starchat');
			provider.setSettings({ temperature: config.get('temperature') });
		} else if (event.affectsConfiguration('starchat.topK')) {
			const config = vscode.workspace.getConfiguration('starchat');
			provider.setSettings({ topK: config.get('topK') });
		} else if (event.affectsConfiguration('starchat.topP')) {
			const config = vscode.workspace.getConfiguration('starchat');
			provider.setSettings({ topP: config.get('topP') });
		}
	});
}


class TextGenerationViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'chatgpt.chatView';
	private _view?: vscode.WebviewView;
	private _chatGPTAPI?: HfInference;

	private _response?: string;
	private _prompt?: string;
	private _fullPrompt?: string;
	private _currentMessageNumber = 0;

	private _settings: Settings = {
		apiUrl: BASE_URL,
		maxNewTokens: 1024,
		temperature: 0.2,
		topK: 50,
		topP: 0.95
	};

	private _authInfo?: AuthInfo;

	// In the constructor, we store the URI of the extension
	constructor(private readonly _extensionUri: vscode.Uri) {

	}

	// Set the API key and create a new API instance based on this key
	public setAuthenticationInfo(authInfo: AuthInfo) {
		this._authInfo = authInfo;
		this._newAPI();
	}

	public setSettings(settings: Settings) {
		let changeModel = false;
		if (settings.apiUrl) {
			changeModel = true;
		}
		this._settings = { ...this._settings, ...settings };

		if (changeModel) {
			this._newAPI();
		}
	}

	public getSettings() {
		return this._settings;
	}

	// This private method initializes a new ChatGPTAPI instance
	private _newAPI() {
		if (!this._authInfo || !this._settings?.apiUrl) {
			console.warn("API key or API URL not set, please go to extension settings (read README.md for more info)");
		}
		else {
			this._chatGPTAPI = new HfInference(this._authInfo.apiKey || "xx");
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		// set options for the webview, allow scripts
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		// set the HTML for the webview
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// add an event listener for messages received by the webview
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'codeSelected':
					{
						let code = data.value;
						const snippet = new vscode.SnippetString();
						snippet.appendText(code);
						// insert the code as a snippet into the active text editor
						vscode.window.activeTextEditor?.insertSnippet(snippet);
						break;
					}
				case 'prompt':
					{
						this.search(data.value);
					}
			}
		});
	}

	public async search(prompt?: string) {
		this._prompt = prompt;
		if (!prompt) {
			prompt = '';
		};

		// Check if the ChatGPTAPI instance is defined
		if (!this._chatGPTAPI) {
			this._newAPI();
		}

		// focus gpt activity from activity bar
		if (!this._view) {
			await vscode.commands.executeCommand('chatgpt.chatView.focus');
		} else {
			this._view?.show?.(true);
		}

		let response = '';
		this._response = '';
		// Get the selected text of the active editor
		const selection = vscode.window.activeTextEditor?.selection;
		const selectedText = vscode.window.activeTextEditor?.document.getText(selection);
		// Get the language id of the selected text of the active editor
		// If a user does not want to append this information to their prompt, leave it as an empty string
		// const languageId = (this._settings.codeblockWithLanguageId ? vscode.window.activeTextEditor?.document?.languageId : undefined) || "";
		let searchPrompt = '';

		if (selection && selectedText) {
			// If there is a selection, add the prompt and the selected text to the search prompt
			searchPrompt = `${prompt}\n${selectedText}\n`;
		} else {
			// Otherwise, just use the prompt if user typed it
			searchPrompt = prompt;
		}
		let promptTemplate = `<|system|>\n<|end|>\n<|user|>\n${searchPrompt}<|end|>\n<|assistant|>`;
		this._fullPrompt = promptTemplate;

		// Increment the message number
		this._currentMessageNumber++;
		let currentMessageNumber = this._currentMessageNumber;

		if (!this._chatGPTAPI) {
			response = '[ERROR] "API key not set or wrong, please go to extension settings to set it (read README.md for more info)"';
		} else {
			// If successfully signed in
			console.log("sendMessage");
			console.log("set prompt", this._prompt);
			// Make sure the prompt is shown
			this._view?.webview.postMessage({ type: 'setPrompt', value: this._prompt });
			this._view?.webview.postMessage({ type: 'addResponse', value: '...' });

			const agent = this._chatGPTAPI;

			try {
				// HFInference
				let temp_response = "";
				for await (const output of this._chatGPTAPI.textGenerationStream({
					model: this._settings.apiUrl || BASE_URL,
					inputs: this._fullPrompt,
					parameters: { max_new_tokens: this._settings.maxNewTokens, temperature: this._settings.temperature, top_k: this._settings.topK, top_p: this._settings.topP }
				}, { fetch: fetch })) {
					if (this._view && this._view.visible) {
						if (output.token.text === "<|end|>") {
							break;
						}
						temp_response += output.token.text;
						this._view?.webview.postMessage({ type: 'addResponse', value: temp_response });
					}
				}
				response = temp_response;

			} catch (e: any) {
				console.error(e);
				if (this._currentMessageNumber === currentMessageNumber) {
					response = this._response;
					response += `\n\n---\n[ERROR] ${e}`;
				}
			}
		}

		if (this._currentMessageNumber !== currentMessageNumber) {
			return;
		}

		// Saves the response
		this._response = response;

		// Show the view and send a message to the webview with the response
		if (this._view) {
			this._view.show?.(true);
			this._view.webview.postMessage({ type: 'addResponse', value: response });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const microlightUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'microlight.min.js'));
		const tailwindUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'showdown.min.js'));
		const showdownUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'tailwind.min.js'));

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<script src="${tailwindUri}"></script>
				<script src="${showdownUri}"></script>
				<script src="${microlightUri}"></script>
				<style>
				.code {
					white-space: pre;
				}
				p {
					padding-top: 0.3rem;
					padding-bottom: 0.3rem;
				}
				/* overrides vscodes style reset, displays as if inside web browser */
				ul, ol {
					list-style: initial !important;
					margin-left: 10px !important;
				}
				h1, h2, h3, h4, h5, h6 {
					font-weight: bold !important;
				}
				</style>
			</head>
			<body>
				<input class="h-10 w-full text-white bg-stone-700 p-4 text-sm" placeholder="Ask Starchat something" id="prompt-input" readonly/>
				
				<div id="response" class="pt-4 text-sm">
				</div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }