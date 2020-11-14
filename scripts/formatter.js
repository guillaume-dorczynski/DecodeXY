import { getSettings } from './settings.js';
import { category, inputType, outputType, decorationType } from './parser.js';
import { setCode } from './codebox.js';
import clone from 'clone';

const reLineEndings = new RegExp('\\r\\n|[\\r\\n]', 'g');

// prettier-ignore
const reCommentsList = [
	[new RegExp('\\/\\*\\s*-- .* --[^]*?\\*\\/\\s*', ''), ''],
	[new RegExp('\\/+\\s*\\/+\\s*(RemoteXY include library|END RemoteXY include)\\s*\\/+\\s*\\/+', 'g'), ''],
	//[new RegExp('^\\s?\\.*\\/\\/\\s*(?:' +
	[new RegExp('\\s*.*\\/\\/\\s*(?:' +
		'RemoteXY select connection mode and include library|' +
		'RemoteXY connection settings|' +
		'RemoteXY configurate|' +
		'this structure defines all the variables and events of your control interface|' +
		'TODO you setup code|' +
		'TODO you loop code[^]*do not call delay\\(\\)' +
		')\\s+', 'g'), ''],
];

let formatterData = undefined;

const resetFormatter = () => {
	formatterData = undefined;
};

const formatter = (t, c, d) => {
	console.log('\nFormatter started');
	if (!formatterData) {
		if (!t && !c && !d) {
			return;
		}
		formatterData = { title: t, content: c, data: d };
	}
	let title = formatterData.title;
	let content = formatterData.content;
	let parsedData = clone(formatterData.data);

	const settings = getSettings();

	let lineEnding = '\r\n';
	if (settings.lineEnding === 0) {
		const lineEndings = { lineEnding: 0 };
		for (const m of content.matchAll(reLineEndings)) {
			const m0 = m[0];
			if (m0) {
				if (lineEndings[m0] === undefined) {
					lineEndings[m0] = 0;
				}
				lineEndings[m0]++;
			}
		}
		lineEnding = Object.keys(lineEndings).reduce((a, b) => (lineEndings[a] > lineEndings[b] ? a : b));
	} else if (settings.lineEnding === 1) {
		lineEnding = '\n';
	}

	const indent = (settings.indentationChar === 0 ? '\t' : ' ').repeat(settings.indentationSize);

	for (const d of parsedData) {
		const a = d.array;
		const s = d.struct;
		a.original = content.substring(a.startPos, a.endPos);
		s.original = content.substring(s.startPos, s.endPos);

		if (settings.structVarsToBools === true) {
			for (const e of a.elements.inputs.buttons) {
				e.structVar.type = 'bool';
			}
			for (const e of a.elements.inputs.switches) {
				e.structVar.type = 'bool';
			}
			s.variables[s.otherVarsIdx].type = 'bool';
		} else {
			s.variables[s.otherVarsIdx].type = 'uint8_t';
		}

		s.maxVarTypeLength = 4;
		for (const e of a.elements.all) {
			if (e.structVar !== undefined && s.maxVarTypeLength < e.structVar.type.length) {
				s.maxVarTypeLength = e.structVar.type.length;
			}
		}

		const structVarToString = (v) => {
			let r = '';
			let h = indent + v.type.padEnd(s.maxVarTypeLength + 1, ' ');
			if (settings.structVarsToArray === false && v.names) {
				for (const n of v.names) {
					r += h + n + ';' + lineEnding;
				}
			} else {
				r += h + v.name + (v.size > 1 ? '[' + v.size + ']' : '') + ';' + lineEnding;
			}
			return r;
		};

		let f = 'struct' + (s.typeName || '') + (settings.bracesStyle === 0 ? lineEnding : ' ') + '{';

		if (a.elements.inputs.all.length > 0) {
			f += lineEnding + indent + '// Inputs' + lineEnding;
			for (const e of a.elements.inputs.all) {
				if (e.structVar.name) {
					f += structVarToString(e.structVar);
				}
			}
		}

		if (a.elements.outputs.all.length > 0) {
			f += lineEnding + indent + '// Outputs' + lineEnding;
			for (const e of a.elements.outputs.all) {
				if (e.structVar.name) {
					f += structVarToString(e.structVar);
				}
			}
		}

		f += lineEnding + indent + '// Other' + lineEnding;
		for (let j = s.otherVarsIdx; j < s.variables.length; j++) {
			f += structVarToString(s.variables[j]);
		}

		f += '}' + (settings.bracesStyle === 0 ? lineEnding : ' ') + (s.objectName || '') + (s.objectSize > 1 ? '[' + s.objectSize + ']' : '') + ';';
		s.formatted = f;

		const pushLine = (e, l) => {
			e.lines.push(l);
			if (l.length > a.maxLineLength) {
				a.maxLineLength = l.length;
			}
		};

		const makeName = (e) => {
			let n = settings.showCategories === true ? 'Unknown ' : '';

			if (e.structVar) {
				const i = e.category === category.input;
				if (settings.showCategories === true) {
					n = (i ? 'In' : 'Out') + 'put ';
				}
				n += e.structVar.name || Object.keys(i ? inputType : outputType)[e.type - 1] + ' (no struct variable)';
			} else if (e.category === category.decoration) {
				if (settings.showCategories === true) {
					n = 'Decoration ';
				}
				switch (e.type) {
					case decorationType.label: {
						n += 'label_' + e.labelId;
						break;
					}
					case decorationType.panel: {
						n += 'panel_' + e.panelId;
						break;
					}
					case decorationType.page: {
						n += 'page_' + e.pageId + (e.isMainPage ? ' (main page)' : '');
						break;
					}
					default: {
						break;
					}
				}
			}
			return n;
		};

		if (settings.fixNegativeValues === true) {
			for (let i = 0; i < a.header.bytes.length; i++) {
				a.header.values[i] = ((a.header.bytes[i] >>> 0) & 0xff).toString();
			}
			for (const e of a.elements.all) {
				for (let i = 0; i < e.bytes.length; i++) {
					e.values[i] = ((e.bytes[i] >>> 0) & 0xff).toString();
				}
			}
		}

		if (settings.showCharacters === true) {
			const nc = settings.showNullCharacters === true ? "'\\0'" : '0';
			for (const e of a.elements.all) {
				if (e.texts) {
					let i = e.texts[0].startPos - e.startPos;
					for (let j = 0; j < e.texts.length; j++) {
						const c = e.texts[j].chars;
						for (let k = 0; k < c.length; k++) {
							e.values[i++] = c[k];
						}
						e.values[i++] = nc;
					}
				}
			}
		}

		const vp = settings.valuesPadding + 1;
		if (vp > 1) {
			for (let i = 0; i < a.header.values.length; i++) {
				a.header.values[i] = a.header.values[i].padStart(vp, ' ');
			}
			for (const e of a.elements.all) {
				for (let i = 0; i < e.values.length; i++) {
					e.values[i] = e.values[i].padStart(e.values[i] === "'$$'" ? vp + 1 : vp, ' ');
				}
			}
		}

		const mv = settings.maxValuesPerLine;
		for (const e of a.elements.all) {
			let l = indent;
			let j = 0;
			const vl = e.values.length;
			e.lines = [];
			for (let i = 0; i < vl; i++) {
				l += e.values[i] + ',';
				if (++j === mv && i !== vl - 1) {
					pushLine(e, l);
					j = 0;
					l = indent;
				}
			}
			pushLine(e, l);
		}

		f = 'uint8_t ' + a.name + '[] =' + (settings.bracesStyle === 0 ? lineEnding : ' ') + '{' + lineEnding;
		let h = indent;
		const n = '// Header' + lineEnding;

		for (const v of a.header.values) {
			h += v + ',';
		}

		if (a.maxLineLength < h.length) {
			a.maxLineLength = h.length;
		}

		const cp = settings.commentsPosition;
		const jl = settings.jumpLines;
		f += cp === 0 ? indent + n + h + lineEnding : h.padEnd(a.maxLineLength + 1, ' ') + n;

		for (const e of a.elements.all) {
			if (jl) {
				f += lineEnding;
			}

			let j = 0;
			const n = '// ' + makeName(e) + lineEnding;

			if (cp === 0) {
				f += indent + n;
			} else {
				f += e.lines[0].padEnd(a.maxLineLength + 1, ' ') + n;
				j = 1;
			}

			for (let i = j; i < e.lines.length; i++) {
				f += e.lines[i] + lineEnding;
			}
		}

		f += '};';
		a.formatted = f;
	}

	for (const d of parsedData) {
		content = content.replace(d.array.original, d.array.formatted);
		content = content.replace(d.struct.original, d.struct.formatted);
	}

	if (settings.structVarsToArray === true) {
		for (const d of parsedData) {
			const sn = d.struct.objectName;
			for (const e of d.array.elements.all) {
				const esv = e.structVar;
				if (esv && esv.names) {
					for (const [ni, n] of esv.names.entries()) {
						const re = new RegExp('(' + sn + '\\s*(?:\\[\\s*.+\\s*\\])?\\s*\\.)' + n, 'g');
						content = content.replace(re, (m, m1) => m1 + esv.name + '[' + ni + ']');
					}
				}
			}
		}
	} else {
		for (const d of parsedData) {
			const sn = d.struct.objectName;
			for (const e of d.array.elements.all) {
				const esv = e.structVar;
				if (esv && esv.names) {
					const re = new RegExp('(' + sn + '\\s*(?:\\[\\s*.+\\s*\\])?\\s*\\.)' + esv.name + '\\s*(?:\\[(\\d+)])', 'g');
					content = content.replace(re, (m, m1, m2) => (esv.names[m2] ? m1 + esv.names[m2] : '// ' + m));
				}
			}
		}
	}

	let replaceVarValue;
	if (settings.structVarsToBools === true) {
		replaceVarValue = (sn, n) => {
			const re = new RegExp('(' + sn + '\\s*(?:\\[\\s*.+\\s*\\])?\\s*\\.' + n + '\\s*\\={1,2}\\s*)(0|1)', 'g');
			content = content.replace(re, (m, m1, m2) => m1 + (m2 === '0' ? 'false' : 'true'));
		};
	} else {
		replaceVarValue = (sn, n) => {
			const re = new RegExp('(' + sn + '\\s*(?:\\[\\s*.+\\s*\\])?\\s*\\.' + n + '\\s*\\={1,2}\\s*)(false|true)', 'g');
			content = content.replace(re, (m, m1, m2) => m1 + (m2 === 'false' ? '0' : '1'));
		};
	}

	for (const d of parsedData) {
		const s = d.struct;
		const sn = s.objectName;
		for (const e of d.array.elements.inputs.buttons) {
			replaceVarValue(sn, e.structVar.name);
		}
		for (const e of d.array.elements.inputs.switches) {
			replaceVarValue(sn, e.structVar.name);
		}
		replaceVarValue(sn, s.variables[s.otherVarsIdx].name);
	}

	//console.log(content.length);
	content = content.replace(reLineEndings, lineEnding);
	//console.log(content.length);

	if (settings.removeComments === true) {
		for (const c of reCommentsList) {
			content = content.replace(c[0], c[1] || '');
		}
	}

	content = content.replace(new RegExp('.*(RemoteXY_)(Init|Handler)\\s*(\\()\\s*(\\))', 'g'), indent + '$1$2$3$4');

	setCode(title, content);

	console.log('Formatter finished\n\n');

	console.json(parsedData, 'Project data');
};

export { formatter, resetFormatter };
