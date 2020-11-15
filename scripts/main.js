import { drawView, toggleSettings, toggleConsole } from './view.js';
import { toggleTooltips } from './tooltips.js';
import { makeSettings, loadSettings, getSetting } from './settings.js';

loadSettings();
makeSettings();

toggleSettings(getSetting('settingsVisible'));
toggleConsole(getSetting('consoleVisible'));

if (getSetting('showTooltips') === false) {
	toggleTooltips(false);
}

drawView();
