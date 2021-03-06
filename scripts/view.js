import '/styles/checkbox.css';
import '/styles/scrollbar.css';
import '/styles/tooltips.css';
import '/styles/json-formatter.less';
import { setSetting, saveSettings, resetSettingsControls } from './settings.js';
import { loadContent } from './loader.js';
import { clearConsole, copyConsole, scrollConsoleToBottom } from './console.js';
import { downloadCode, resetCode, copyCode } from './codebox.js';
import { resetFormatter } from './formatter.js';

window.onbeforeunload = () => saveSettings();

const elements = {
	buttonShowSettings: true,
	buttonHideSettings: true,
	buttonResetSettings: true,
	buttonShowConsole: true,
	buttonHideConsole: true,
	buttonClearConsole: true,
	buttonCopyConsole: true,
	buttonCopyCode: true,
	buttonDownloadCode: true,
	settingsContainer: true,
	consoleContainer: true,
	hiddenFileInput: true,
	bigButton: true,
	buttonResetCode: true,
	codeTitle: true,
};

for (const e of Object.keys(elements)) {
	elements[e] = document.getElementById(e);
}

elements.buttonShowSettings.onclick = () => {
	toggleSettings(true);
};

elements.buttonHideSettings.onclick = () => {
	toggleSettings(false);
};

elements.buttonResetSettings.onclick = () => {
	resetSettingsControls();
};

elements.buttonShowConsole.onclick = () => {
	toggleConsole(true);
};

elements.buttonHideConsole.onclick = () => {
	toggleConsole(false);
};

elements.buttonClearConsole.onclick = () => {
	clearConsole();
};

elements.buttonCopyConsole.onclick = () => {
	copyConsole();
};

elements.buttonCopyCode.onclick = () => {
	copyCode();
};

elements.buttonDownloadCode.onclick = () => {
	downloadCode();
};

elements.buttonResetCode.onclick = () => {
	resetCode();
	resetFormatter();
	clearConsole();
};

const drawView = () => {
	document.body.style.visibility = 'visible';
};

const toggleSettings = (v) => {
	elements.settingsContainer.style.display = v ? 'flex' : 'none';
	elements.buttonShowSettings.hidden = v;
	setSetting('settingsVisible', v);
};

const toggleConsole = (v) => {
	elements.consoleContainer.style.display = v ? 'flex' : 'none';
	if (v) {
		scrollConsoleToBottom();
	}
	elements.buttonShowConsole.hidden = v;
	setSetting('consoleVisible', v);
};

document.body.ondragenter = (e) => {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.effectAllowed = 'none';
	e.dataTransfer.dropEffect = 'none';
};

document.body.ondragover = (e) => {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.effectAllowed = 'none';
	e.dataTransfer.dropEffect = 'none';
};

let mouseInside = false;

document.body.onpaste = (e) => {
	e.stopPropagation();
	e.preventDefault();
	if (mouseInside) {
		if (e.clipboardData.items) {
			for (const i of e.clipboardData.items) {
				if (loadContent(i, 'p') === true) {
					break; // fixme
				}
			}
		}
	}
};

const allowedFileTypes = {
	zip: true,
	ino: true,
	pde: true,
	txt: true,
	cpp: true,
	hpp: true,
	c: true,
	h: true,
};

let allowedFileTypesStr = '';
for (const e of Object.keys(allowedFileTypes)) {
	allowedFileTypesStr += '.' + e + ',';
}

elements.hiddenFileInput.setAttribute('accept', allowedFileTypesStr);
elements.hiddenFileInput.onchange = (e) => {
	if (e.target.files) {
		for (const f of e.target.files) {
			loadContent(f);
			break; //fixme
		}
	}
	e.target.value = '';
};

elements.bigButton.ondragenter = (e) => {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.effectAllowed = 'copy';
	e.dataTransfer.dropEffect = 'copy';
	elements.bigButton.classList.toggle('dropHover');
};

elements.bigButton.ondragover = (e) => {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.effectAllowed = 'copy';
	e.dataTransfer.dropEffect = 'copy';
};

elements.bigButton.ondragleave = (e) => {
	e.stopPropagation();
	e.preventDefault();
	elements.bigButton.classList.toggle('dropHover');
};

elements.bigButton.ondrop = (e) => {
	e.stopPropagation();
	e.preventDefault();
	elements.bigButton.classList.toggle('dropHover');
	if (e.dataTransfer.items) {
		for (const i of e.dataTransfer.items) {
			loadContent(i, 'd');
			break; //fixme
		}
	}
};

elements.bigButton.onmouseover = (e) => {
	e.stopPropagation();
	e.preventDefault();
	mouseInside = true;
};

elements.bigButton.onmouseout = (e) => {
	e.stopPropagation();
	e.preventDefault();
	mouseInside = false;
};

elements.bigButton.onclick = (e) => {
	e.stopPropagation();
	e.preventDefault();
	elements.hiddenFileInput.click();
};

export { drawView, toggleSettings, toggleConsole, allowedFileTypes };
