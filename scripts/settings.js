import { createTooltip, toggleTooltips } from './tooltips.js';
//import { inputString, printString } from './view.js';
//import { parser } from './parser.js';
//import { parseContent } from './loader.js';
import { formatter } from './formatter.js';

const settings = {
	settingsVisible: { value: true },
	consoleVisible: { value: false },

	/*Test: { label: true },
	button1: {
		label: false,
		type: 'button',
		tooltip: 'button 1',
		tooltipOnControl: true,
		onClick: (c, k, v) => controlTest(c, k, v),
		attributes: { value: 'A', style: 'margin: 5px' },
		rowStyle: 'padding: 5px;',
	},
	button2: {
		type: 'button',
		tooltip: 'button 2',
		tooltipOnControl: true,
		onClick: (c, k, v) => controlTest(c, k, v),
		attributes: { value: 'B', style: 'margin: 5px' },
	},
	button3: {
		type: 'button',
		tooltip: 'button 3',
		tooltipOnControl: true,
		onClick: (c, k, v) => controlTest(c, k, v),
		attributes: { value: 'C', style: 'margin: 5px' },
	},

	Preset: { label: true },
	preset: {
		label: 'Load preset',
		tooltip: 'Choose a settings preset',
		value: 0,
		type: 'select',
		options: { 0: 'Default', 1: 'Compact', 2: 'Custom' },
		attributes: { style: 'width: 105px' },
		onChange: (c, k, v) => controlTest(c, k, v),
		save: false,
		update: false,
	},*/

	General: { label: true },
	indentationSize: {
		label: 'Indentation',
		tooltip: 'How many spaces or tabs to put in front of each line.',
		type: 'number',
		attributes: { min: 0, max: 10 },
		value: 1,
	},
	indentationChar: {
		type: 'select',
		options: { 0: 'Tabs', 1: 'Spaces' },
		value: 0,
	},
	bracesStyle: {
		label: 'Braces style',
		tooltip: "'Allman' will put opening braces ('{') on a new line. 'OTBS' will put them on the same line.",
		type: 'select',
		options: { 0: 'Allman', 1: 'OTBS' },
		value: 0,
		stick: true,
	},
	lineEnding: {
		label: 'Normalize line ending',
		tooltip: 'This will change all Line Ending characters of the file.',
		type: 'select',
		options: { 0: 'Detect', 1: 'LF', 2: 'CR+LF' },
		value: 2,
	},
	/*removeComments: {
		label: 'Delete RemoteXY comments',
		tooltip: "Enable this option to delete all RemoteXY's default comments.",
		type: 'checkbox',
		value: true,
	},*/

	Array: { label: true },
	commentsPosition: {
		label: 'Comments position',
		tooltip: 'The place where the comments will be added, either above an element or on its right.',
		type: 'select',
		options: { 0: 'Above', 1: 'Aside' },
		value: 0,
	},
	showCategories: {
		label: 'Show categories',
		tooltip: 'Enable this option to add the element category in the comment.',
		type: 'checkbox',
		value: true,
		stick: true,
	},
	maxValuesPerLine: {
		label: 'Max values per line',
		tooltip: 'Maximum values to show on a line before going to the next line.',
		type: 'number',
		attributes: { min: 10, max: 999 },
		value: 20,
	},
	valuesPadding: {
		label: 'Values padding',
		tooltip: 'Minimum width of values. It will add spaces in front of each values.',
		type: 'number',
		attributes: { min: 0, max: 5 },
		value: 3,
		stick: true,
	},
	jumpLines: {
		label: 'Jump a line between elements',
		tooltip: 'Enable this option to separate each elements with an empty line.',
		type: 'checkbox',
		value: true,
	},
	fixNegativeValues: {
		label: 'Fix negative values',
		tooltip: 'Enable this option to fix rare cases where the RemoteXY Editor write negative values in the array, which produces warnings or errors with some compilers.',
		type: 'checkbox',
		value: true,
	},
	showCharacters: {
		label: 'Show texts characters',
		tooltip: 'Enable this option to convert bytes to characters when needed, so you can see texts. Multibyte characters will not be converted.',
		type: 'checkbox',
		value: true,
	},
	showNullCharacters: {
		label: "Show '\\0' at the end",
		tooltip: 'Enable this option to show null characters at the end of texts.',
		type: 'checkbox',
		value: true,
		stick: true,
	},

	Struct: { label: true },
	structVarsToBools: {
		label: 'Change variables to bools',
		tooltip: 'When this option is enabled, elements such as Buttons and Switches will use bool instead of uint8_t data type.',
		type: 'checkbox',
		value: true,
	},
	structVarsToArray: {
		label: 'Change variables to arrays',
		tooltip: 'When this option is enabled, elements such as Leds and Joysticks will use an array instead of multiple variables. The name will be slightly modified.',
		type: 'checkbox',
		value: true,
	},

	Other: { label: true },
	showTooltips: {
		label: 'Show tooltips',
		tooltip: 'Do you really want to see these annoying tooltips forever..?',
		type: 'checkbox',
		value: true,
		update: false,
		onChange: (c, k, v) => toggleTooltips(v.value),
	},
	/*debug: {
		label: 'Debug mode',
		tooltip: 'Enable this option to show additional information in the Console. Use only if you find a bug and want to report it.',
		type: 'checkbox',
		value: false,
	},*/
};

const setSetting = (k, v) => {
	if (settings[k] !== undefined) {
		settings[k].value = v;
	}
};

const getSetting = (k) => {
	const s = settings[k];
	if (s !== undefined && s.value !== undefined) {
		return s.value;
	}
};

const getSettings = () => {
	let o = {};
	for (const k of Object.keys(settings)) {
		const s = getSetting(k);
		if (s !== undefined) {
			o[k] = s;
		}
	}
	return o;
};

/*
const controlTest = (c, k, v) => {
	console.log(c);
	console.log(c.outerHTML);
	console.log(k);
	console.log(v);
};
*/

const resetSettingsControls = () => {
	for (const v of Object.values(settings)) {
		if (v.control !== undefined && v.value !== undefined && v.defaultValue !== undefined) {
			v.value = v.defaultValue;
			if (v.type === 'checkbox') {
				v.control.checked = v.value;
			} else {
				v.control.value = v.value;
			}
		}
	}

	/*if (inputString !== '') {
		//parseContent(inputString);
		printString(inputString);
	}*/
	//parseContent();
	formatter();
};

const localStorageAvailable = () => {
	try {
		const x = document.title + '.x';
		localStorage.setItem(x, '1');
		localStorage.removeItem(x);
		return true;
	} catch (e) {
		return false;
	}
};

const useLocalStorage = false; //localStorageAvailable();

const saveSettings = () => {
	const saveSetting = (k, v) => {
		const n = document.title + '.' + k;
		if (useLocalStorage === true) {
			localStorage.setItem(n, v);
		} else {
			document.cookie = encodeURIComponent(n) + '=' + encodeURIComponent(v) + ';expires=Tue, 19 Jan 2038 03:14:07 GMT;path=/';
		}
	};

	for (const [k, v] of Object.entries(settings)) {
		if (v.save !== false && v.value !== undefined && (v.savedValue === undefined || v.value !== v.savedValue)) {
			saveSetting(k, v.value);
		}
	}
};

//window.onbeforeunload = saveSettings;

const fixType = (v, s) => {
	let r = v;
	switch (typeof r) {
		case 'boolean': {
			r = s === 'true';
			break;
		}
		case 'number': {
			r = Number(s);
			break;
		}
		case 'string': {
			r = s;
			break;
		}
		default: {
			break;
		}
	}
	return r;
};

const loadSettings = () => {
	const loadSetting = (k, s) => {
		const v = settings[k];
		if (v && s !== undefined && s !== null && v.value !== undefined) {
			v.value = fixType(v.value, s);
			v.savedValue = v.value;
			if (v.onLoad !== undefined && typeof v.onLoad === 'function') {
				v.onLoad(k, v);
			}
		}
	};

	for (const v of Object.values(settings)) {
		if (v.value !== undefined) {
			v.defaultValue = v.value;
		}
	}

	if (useLocalStorage === true) {
		for (const k of Object.keys(settings)) {
			loadSetting(k, localStorage.getItem(document.title + '.' + k));
		}
	} else {
		// Regex to parse cookies
		// prettier-ignore
		const r = new RegExp(
			encodeURIComponent(document.title) + // search document title...
			"\\.([^.\\s]+)" +                    // followed by '.' and capture key (group 1)...
			"(?:\\.([^.\\s]+))?" +               // optionally followed by '.' and capture subkey1 (group 2) (unused yet)...
			"(?:\\.([^.\\s]+))?" +               // optionally followed by '.' and capture subkey2 (group 3) (unused yet)...
			"\\s*=\\s*" +                        // skip any whitespace around '='
			"([^;\\s]+)",                        // capture value (group 4) until ';'
			"g",
		);
		for (const m of document.cookie.matchAll(r)) {
			loadSetting(decodeURIComponent(m[1]), decodeURIComponent(m[4]));
		}
	}
};

const makeSettings = () => {
	const onChange = (c, k) => {
		const v = settings[k];

		if (v.type === 'checkbox') {
			v.value = c.checked;
		} else if (v.type === 'number') {
			if (c.value === '') {
				c.value = v.value;
			} else {
				const a = v.attributes;
				if (a !== undefined) {
					const n = Number(c.value);
					if (a.min !== undefined && n <= a.min) {
						c.value = a.min;
					} else if (a.max !== undefined && n >= a.max) {
						c.value = a.max;
					}
				}
			}
			v.value = Number(c.value);
		} else {
			v.value = fixType(v.value, c.value);
		}

		if (v.onChange !== undefined && typeof v.onChange === 'function') {
			v.onChange(c, k, v);
		}

		if (v.update !== false) {
			//&& inputString !== '') {
			//parseContent(inputString);
			//printString(inputString);
			//parseContent();
			formatter();
		}
	};

	const s = document.getElementById('settingsTop');
	let b;
	let p_r;
	let p_l;

	for (const [k, v] of Object.entries(settings)) {
		if (v.label === true) {
			const g = document.createElement('div');
			g.className = 'settingsGroupLabel';
			g.textContent = k;
			s.appendChild(g);
			p_r = undefined;
			p_l = undefined;
		} else if (v.type) {
			if (b === undefined || v.label) {
				const r = document.createElement('div');
				r.className = 'settingRow';
				b = document.createElement('div');
				b.className = 'settingBox';

				if (v.label !== false) {
					const l = document.createElement('label');
					l.className = 'settingLabel';
					l.textContent = v.label || '';
					l.appendChild(b);

					r.appendChild(l);

					if (v.style) {
						l.style = v.style;
					}

					/*if (v.tooltip !== undefined) {
						createTooltip(l, v.tooltip, {
							onShow: (t) =>
								t.setProps({
									offset: [0, isScrollableVertically(settingsPanel) ? 21 : 11],
								}),
						});
					}*/

					if (v.stick === true && p_r && p_l) {
						p_r.style['border-style'] = 'none';
						p_l.style['padding-bottom'] = '2px';
						l.style['padding-top'] = '2px';
					}

					p_l = l;
				} else {
					r.appendChild(b);
				}

				s.appendChild(r);

				if (v.rowStyle) {
					r.style = v.rowStyle;
				}

				if (v.boxStyle) {
					b.style = v.boxStyle;
				}

				p_r = r;
			}
			v.row = p_r;

			const e = document.createElement(v.type !== 'select' ? 'input' : v.type);
			e.className = v.type;
			b.appendChild(e);
			v.control = e;
			v.labelId = p_l;
			/*v.labelId.onhover = (e) => {
				e.target.style['color'] = '#ffffff';
				v.labelId.style['color'] = '#ffffff';
			};
			e.onfocus = (e) => {
				e.target.style['color'] = '#ffffff';
				v.labelId.style['color'] = '#ffffff';
			};
			e.onblur = (e) => {
				e.target.style['color'] = '#d2d2d2';
				v.labelId.style['color'] = '#d2d2d2';
			};*/
			if (v.tooltip !== undefined) {
				createTooltip(e, v.tooltip, {
					triggerTarget: v.tooltipOnControl ? e : v.row,
					getReferenceClientRect: () => {
						const sr = s.getBoundingClientRect();
						const rr = v.row.getBoundingClientRect();
						return {
							width: sr.width,
							height: rr.height,
							top: rr.top,
							bottom: rr.bottom,
							left: sr.left,
							right: sr.right,
						};
					},
				});
			}

			if (v.type !== 'select') {
				e.type = v.type;
			}

			if (v.type === 'button' && v.onClick !== undefined && typeof v.onClick === 'function') {
				v.save = false;
				e.onclick = (e) => v.onClick(e.target, k, v);
			}

			if (v.label === undefined) {
				e.style['margin-left'] = '4px';
			}

			if (v.attributes !== undefined) {
				for (const [k2, v2] of Object.entries(v.attributes)) {
					e[k2] = v2;
				}
			}

			if (v.options !== undefined) {
				for (const [k2, v2] of Object.entries(v.options)) {
					const o = document.createElement('option');
					o.value = k2;
					o.textContent = v2;
					o.className = 'option';
					e.add(o);
				}
			}

			if (v.value !== undefined) {
				if (v.type === 'checkbox') {
					e.checked = v.value;
				} else {
					e.value = v.value;
				}
				e.onchange = (e) => onChange(e.target, k);
			}
		}
	}
};

export { makeSettings, loadSettings, saveSettings, setSetting, getSetting, getSettings, resetSettingsControls };
