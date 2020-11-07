import { drawView, toggleSettings, toggleConsole } from './view.js';
import { toggleTooltips } from './tooltips.js';
import { makeSettings, loadSettings, getSetting } from './settings.js';
//import { setCode } from './codebox.js';

loadSettings();
makeSettings();

toggleSettings(getSetting('settingsVisible'));
toggleConsole(getSetting('consoleVisible'));

if (getSetting('showTooltips') === false) {
	toggleTooltips(false);
}

//setCode('//Open a file or paste text');

drawView();

console.log('Ready');
