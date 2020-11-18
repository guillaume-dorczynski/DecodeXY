import { formatter } from './formatter.js';
import treeify from 'treeify';

// Regex to remove comments
// prettier-ignore
const reComment = new RegExp(
	"(?:\\/\\*[^]*?\\*\\/)" + // search "/*" and any characters until "*/"
	"|" +                     // or
	"(?:\\/\\/.*)",           // search "//" and any characters until line terminator
	"g"
);

// Regex to find arrays looking like RemoteXY_CONF, to be validated afterward.
// Don't search for name RemoteXY_CONF, because it may have been modified by user
// prettier-ignore
const reArray = new RegExp(
	"uint8_t" +                   // search "uint8_t"
	"\\s+([^;]+?)" +              // skip at least one whitespace, capture variable-name (group 1)
	"\\s*\\[\\s*(\\d*?)\\s*\\]" + // skip any whitespaces until "[", try capture variable-size (group 2), skip any whitespaces until "]"
	"\\s*=\\s*{" +                // skip any whitespaces until "=", skip any whitespaces until "{"
	"\\s*([^]+?),?" +             // skip any whitespaces and capture array content (group 3) until a possible "," at the last value of the array
	"\\s*}\\s*;",                 // skip any whitespaces until "}", skip any whitespaces until ";"
	"g"
);

// Regex to extract array content
// prettier-ignore
const reArrayData = new RegExp(
	"\\s*(-?\\s*\\b(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\\b)" + // capture number in range 0-255, possibly negative (group 1)
	"|'([^\\\\]|\\\\[^\\d]|\\d)'" +                                            // or character like 'c' or '\n' (group 2)
	"|(0x[0-9a-fA-F]{1,2}|'\\\\x[0-9a-fA-F]{1,2}'|'\\\\u00[0-9a-fA-F]{2}')" +  // or hex value like 0x63, '\x63', or '\u0063' (group 3)
	"|'(\\\\\\d{1,3})'" +                                                      // or octal value like '\143' (group 4)
	"|((?:0b|0B|B)\\d{1,8})",                                                  // or binary value like 0b1100011 or B1100011 (group 5)
	"g"
);

// Regex to search structs
// prettier-ignore
const reStruct = new RegExp(
	"struct" +                             // search "struct" followed by either
	"(?:\\s*{" +                           // any whitespaces and "{"
	"|" +                                  // or
	"\\s+([^]+?)\\s*{)" +                  // skip at least one whitespace, try capture a type-name (group 1), until any whitespaces and "{"
	"\\s*([^]+?)\\s*}" +                   // skip any whitespaces, capture struct content (group 2), until any whitespaces and "}",
	"(?:\\s*|\\s*([^]+?)?)" +              // skip any whitespaces and try capture an object-name (group 3),
	"\\s*(?:\\[\\s*([^]+?)\\s*\\])?\\s*;", // skip any whitespaces, try capture object-size (group 4) between [], until any whitespaces and ";"
	"g"
);

// Regex to extract struct content
// prettier-ignore
const reStructData = new RegExp(
	"(bool|int8_t|uint8_t|char|int16_t|uint16_t|float)" + // capture variable-type (group 1)
	"\\s+([^\\s]+?)" +                                    // skip at least one whitespace, capture variable-name (group 2)
	"\\s*(?:\\[\\s*(\\d+)\\s*\\])?\\s*\\;",               // skip any whitespaces, try capture variable-size (group 3) between [], until any whitespaces and ";"
	"g"
);

const reSpaces = new RegExp('\\s*', 'g');

const escapedCharacters = {
	'\\0': '\0',
	"\\'": "'",
	'\\"': '"',
	'\\?': '?',
	'\\\\': '\\',
	'\\a': '\x07',
	'\\b': '\b',
	'\\f': '\f',
	'\\n': '\n',
	'\\r': '\r',
	'\\t': '\t',
	'\\v': '\v',
};

for (const [k, v] of Object.entries(escapedCharacters)) {
	escapedCharacters[v] = k;
}

const sizeOfType = {
	bool: 1,
	int8_t: 1,
	uint8_t: 1,
	char: 1,
	int16_t: 2,
	uint16_t: 2,
	float: 4,
};

const viewOrientation = {
	horizontal: 0,
	vertical: 1,
	both: 2,
};

const category = {
	input: 0,
	output: 1,
	decoration: 2,
};

const editFieldType = {
	text: 0,
	float: 1,
	integer: 2,
};

const inputType = {
	button: 1,
	switch: 2,
	select: 3,
	slider: 4,
	joystick: 5,
	colorPicker: 6,
	editField: 7,
};

const outputType = {
	led: 1,
	level: 2,
	textString: 3,
	onlineGraph: 4,
	sound: 5,
};

const decorationType = {
	label: 1,
	panel: 2,
	page: 3,
};

const textAtPos = (n, p) => {
	let i = p;
	let b;
	let ac = [];

	while (n[i] !== 0) {
		b = (n[i] >>> 0) & 0xff;
		const c = String.fromCharCode(b);
		const e = escapedCharacters[c];
		ac.push(e || (b >= 32 && b <= 127) ? "'" + (e ? e : c) + "'" : b.toString());
		i++;
	}

	return {
		chars: ac,
		text: new TextDecoder('utf-8').decode(Uint8Array.from(n.slice(p, i))),
		startPos: p,
		endPos: i,
	};
};

const parser = (title, content) => {
	console.log('Parser started');
	let c = content;
	let parsedData = [];
	let arrays = [];
	let structs = [];

	c = c.replace(reComment, (m) => ' '.repeat(m.length));

	console.log('  Searching structs');
	for (const m of c.matchAll(reStruct)) {
		const s = {
			startPos: m.index,
			endPos: m.index + m[0].length,
			typeName: m[1] || '',
			objectName: m[3] || '',
			objectSize: m[4] || 1,
			size: 0,
			variables: [],
		};

		const FLProgTypes = {
			'unsigned char': 'uint8_t',
			'signed char': 'int8_t',
		};
		for (const [k, v] of Object.entries(FLProgTypes)) {
			m[2] = m[2].replace(new RegExp(k, 'g'), v);
		}

		for (const m2 of m[2].matchAll(reStructData)) {
			const v = {
				type: m2[1],
				name: m2[2],
				size: m2[3] ? Number(m2[3]) : 1,
			};
			s.size += v.size * sizeOfType[v.type];
			s.variables.push(v);
		}

		structs.push(s);
	}

	const structsLenght = structs.length;
	if (structsLenght === 0) {
		console.warn('    No struct found!');
		return;
	} else {
		console.info('    Found ' + structsLenght + ' struct' + (structsLenght > 1 ? 's' : ''));
	}

	console.log('  Searching arrays');
	const headerSize = 10;
	for (const m of c.matchAll(reArray)) {
		if (m[3]) {
			let i = 0;
			const an = [];

			for (const m2 of m[3].matchAll(reArrayData)) {
				let n;
				if (m2) {
					if (m2[1]) {
						n = Number(m2[1].replace(reSpaces, ''));
					} else if (m2[2]) {
						if (m2[2].charAt(0) === '\\') {
							const e = escapedCharacters[m2[2]];
							n = e ? e.charCodeAt(0) : m2[2].charCodeAt(1);
						} else {
							n = m2[2].charCodeAt(0);
						}
					} else if (m2[3]) {
						n = parseInt(m2[3].substring(m2[3].charAt(0) === "'" ? 3 : 2), 16);
					} else if (m2[4]) {
						n = parseInt(m2[4].substring(1), 8);
					} else if (m2[5]) {
						n = parseInt(m2[5].substring(m2[5].charAt(0) === 'B' ? 1 : 2), 2);
					}
				}
				if (n === undefined) {
					break;
				} else {
					an[i++] = n;
				}
			}

			if (i >= headerSize && an[0] === 255 && i === ((an[6] << 8) | an[5]) + 7) {
				let j = 0;
				let k = 0;
				const a = {
					startPos: m.index,
					endPos: m.index + m[0].length,
					name: m[1],
					size: m[2] ? Number(m[2]) : -1,
					header: {
						values: [],
						bytes: [],
						totalInputs: (an[2] << 8) | an[1],
						totalOutputs: (an[4] << 8) | an[3],
						totalBytes: i - headerSize,
						backgroundColor: an[8],
						flags: {
							viewOrientation: an[9] & 0b00000011,
							pagesEnabled: (an[9] & 0b00000100) >> 2,
						},
					},
					maxLineLength: 0,
					elements: {
						totalInputs: 0,
						totalOutputs: 0,
						totalBytes: 0,
						all: [],
						inputs: {
							all: [],
							buttons: [],
							switches: [],
							selects: [],
							sliders: [],
							joysticks: [],
							colorPickers: [],
							editFields: [],
						},
						outputs: {
							all: [],
							leds: [],
							levels: [],
							textStrings: [],
							onlineGraphs: [],
							sounds: [],
						},
						decorations: {
							all: [],
							labels: [],
							panels: [],
							pages: [],
						},
					},
				};

				while (j < headerSize) {
					a.header.bytes[j] = an[j];
					a.header.values[j] = an[j].toString();
					j++;
				}
				while (j < i - 1) {
					const e = {
						startPos: j,
						endPos: 0,
						category: an[j] >> 6,
						type: an[j] & 0b00001111,
						values: [],
						bytes: [],
						lines: [],
						id: an[j],
						flags: an[++j],
						x1: an[++j],
						y1: an[++j],
						w1: an[++j],
						h1: an[++j],
					};
					if (a.header.flags.viewOrientation === viewOrientation.both) {
						e.x2 = an[++j];
						e.y2 = an[++j];
						e.w2 = an[++j];
						e.h2 = an[++j];
					}
					if (a.header.flags.pagesEnabled === 1) {
						e.pageId = an[++j];
					}

					switch (e.category) {
						case category.input: {
							switch (e.type) {
								case inputType.button: {
									e.shape = e.flags & 0b00000011;
									e.borderStyle = (e.flags & 0b00001100) >> 2;
									e.backgroundColor = an[++j];
									e.textColor = an[++j];
									e.texts = [textAtPos(an, ++j)];
									j = e.texts[0].endPos;
									e.structVar = { type: 'uint8_t', size: 1, type2: 'bool' };
									a.elements.inputs.buttons.push(k);
									break;
								}
								case inputType.switch: {
									e.shape = e.flags & 0b00000011;
									e.buttonColor = an[++j];
									e.backgroundColor = an[++j];
									e.textOnColor = an[++j];
									e.textOffColor = an[++j];
									e.texts = [];
									e.texts[0] = textAtPos(an, ++j);
									e.texts[1] = textAtPos(an, e.texts[0].endPos + 1);
									j = e.texts[1].endPos;
									e.structVar = { type: 'uint8_t', size: 1, type2: 'bool' };
									a.elements.inputs.switches.push(k);
									break;
								}
								case inputType.select: {
									e.optionsCount = e.flags & 0b00000111;
									e.orientation = (e.flags & 0b10000000) >> 7;
									e.buttonColor = an[++j];
									e.backgroundColor = an[++j];
									e.structVar = { type: 'uint8_t', size: 1 };
									a.elements.inputs.selects.push(k);
									break;
								}
								case inputType.slider: {
									e.alwaysCenter = (e.flags & 0b00010000) >> 4;
									e.centerPosition = (e.flags & 0b01100000) >> 5;
									e.orientation = (e.flags & 0b10000000) >> 7;
									e.buttonColor = an[++j];
									e.backgroundColor = an[++j];
									e.structVar = { type: 'int8_t', size: 1 };
									a.elements.inputs.sliders.push(k);
									break;
								}
								case inputType.joystick: {
									e.buttonsPositions = e.flags & 0b00011111;
									e.automaticCenter = (e.flags & 0b00100000) >> 5;
									e.buttonColor = an[++j];
									e.backgroundColor = an[++j];
									e.textColor = an[++j];
									e.structVar = { type: 'int8_t', size: 2 };
									a.elements.inputs.joysticks.push(k);
									break;
								}
								case inputType.colorPicker: {
									e.buttonColor = an[++j];
									e.backgroundColor = an[++j];
									e.structVar = { type: 'uint8_t', size: 3 };
									a.elements.inputs.colorPickers.push(k);
									break;
								}
								case inputType.editField: {
									e.alignment = e.flags & 0b00000011;
									e.showBackground = (e.flags & 0b00000100) >> 2;
									e.inputType = (e.flags & 0b00011000) >> 3;
									e.showClearButton = (e.flags & 0b00100000) >> 5;
									e.textColor = an[++j];
									e.backgroundColor = an[++j];
									e.buttonColor = an[++j];
									if (e.inputType === editFieldType.text) {
										e.maxTextLength = an[++j];
										e.structVar = { type: 'char', size: e.maxTextLength };
									} else if (e.inputType === editFieldType.float) {
										e.maxDecimals = an[++j];
										e.structVar = { type: 'float', size: 1 };
									} else if (e.inputType === editFieldType.integer) {
										e.structVar = { type: 'int16_t', size: 1 };
									}
									a.elements.inputs.editFields.push(k);
									break;
								}
								default: {
									break;
								}
							}
							a.elements.inputs.all.push(k);
							if (e.structVar.size > 0) {
								a.elements.totalInputs += e.structVar.size * sizeOfType[e.structVar.type];
							}
							break;
						}
						case category.output: {
							switch (e.type) {
								case outputType.led: {
									e.rgbChannels = e.flags & 0b00000111;
									e.shape = (e.flags & 0b00001000) >> 3;
									e.border = (e.flags & 0b00110000) >> 4;
									e.structVar = { type: 'uint8_t', size: 0 };
									for (let i = 0; i < 3; i++) {
										if ((e.rgbChannels >> i) & 1) {
											e.structVar.size++;
										}
									}
									a.elements.outputs.leds.push(k);
									break;
								}
								case outputType.level: {
									e.levelType = e.flags & 0b00000111;
									e.centerPosition = (e.flags & 0b01100000) >> 5;
									e.orientation = (e.flags & 0b10000000) >> 7;
									e.color = an[++j];
									e.backgroundColor = an[++j];
									e.structVar = { type: 'int8_t', size: 1 };
									a.elements.outputs.levels.push(k);
									break;
								}
								case outputType.textString: {
									e.alignment = e.flags & 0b00000011;
									e.showBackground = (e.flags & 0b00000100) >> 2;
									e.textColor = an[++j];
									e.backgroundColor = an[++j];
									e.maxTextLength = an[++j];
									e.structVar = { type: 'char', size: e.maxTextLength };
									a.elements.outputs.textStrings.push(k);
									break;
								}
								case outputType.onlineGraph: {
									e.valuesCount = e.flags & 0b00001111;
									e.showValues = (e.flags & 0b00010000) >> 4;
									e.showLegends = (e.flags & 0b00100000) >> 5;
									e.backgroundColor = an[++j];
									e.structVar = { type: 'float', size: e.valuesCount };
									e.colors = [];
									for (let i = 0; i < e.valuesCount; i++) {
										e.colors[i] = an[++j];
									}
									if (e.showLegends === 1) {
										e.texts = [];
										for (let i = 0; i < e.valuesCount; i++) {
											e.texts[i] = textAtPos(an, ++j);
											j = e.texts[i].endPos;
										}
									}
									a.elements.outputs.onlineGraphs.push(k);
									break;
								}
								case outputType.sound: {
									e.hide = e.flags & 0b00000001;
									e.structVar = { type: 'int16_t', size: 1 };
									if (e.hide === 0) {
										e.color = an[++j];
									}
									a.elements.outputs.sounds.push(k);
									break;
								}
								default: {
									break;
								}
							}
							a.elements.outputs.all.push(k);
							if (e.structVar.size > 0) {
								a.elements.totalOutputs += e.structVar.size * sizeOfType[e.structVar.type];
							}
							break;
						}
						case category.decoration: {
							switch (e.type) {
								case decorationType.label: {
									e.labelId = a.elements.decorations.labels.length + 1;
									e.textColor = an[++j];
									e.texts = [textAtPos(an, ++j)];
									j = e.texts[0].endPos;
									a.elements.decorations.labels.push(k);
									break;
								}
								case decorationType.panel: {
									e.panelId = a.elements.decorations.panels.length + 1;
									e.bevel = e.flags & 0b00000011;
									e.color = an[++j];
									a.elements.decorations.panels.push(k);
									break;
								}
								case decorationType.page: {
									e.isMainPage = e.flags & 0b00000001;
									e.border = (e.flags & 0b00000110) >> 1;
									e.backgroundColor = an[++j];
									e.textColor = an[++j];
									e.texts = [textAtPos(an, ++j)];
									j = e.texts[0].endPos;
									a.elements.decorations.pages.push(k);
									break;
								}
								default: {
									break;
								}
							}
							a.elements.decorations.all.push(k);
							break;
						}
						default: {
							break;
						}
					}
					e.endPos = j++;
					for (let i = 0, j = e.startPos; j <= e.endPos; i++, j++) {
						e.bytes[i] = an[j];
						e.values[i] = e.bytes[i].toString();
					}
					a.elements.totalBytes += e.bytes.length;
					a.elements.all.push(e);
					k++;
				}
				if (i === j && a.elements.totalInputs === a.header.totalInputs && a.elements.totalOutputs === a.header.totalOutputs) {
					arrays.push(a);
				}
			}
		}
	}

	const arraysLenght = arrays.length;
	if (arraysLenght === 0) {
		console.warn('    No array found!');
		return;
	} else {
		console.info('    Found ' + arraysLenght + ' array' + (arraysLenght > 1 ? 's' : ''));
		let error = false;
		for (const [ai, a] of arrays.entries()) {
			const n = a.header.totalInputs + a.header.totalOutputs;
			const elements = [...a.elements.inputs.all, ...a.elements.outputs.all];
			for (const [si, s] of structs.entries()) {
				if (a.structId === undefined && s.arrayId === undefined) {
					if (s.size === n + 1) {
						let i = 0;
						let j = 0;
						for (; i < elements.length; i++) {
							const e = a.elements.all[elements[i]];
							const esv = e.structVar;
							if (esv.size > 0) {
								let sv = s.variables[j];
								if (esv.size === sv.size) {
									if (esv.type === sv.type || esv.type2 === sv.type) {
										let n = sv.name;
										esv.name = n;
										if (esv.size > 1) {
											if (e.category === category.output) {
												if (e.type === outputType.led) {
													esv.names = [];
													const rgb = e.rgbChannels;
													if (rgb & 0b100) {
														esv.names.push(n + '_r');
													}
													if (rgb & 0b010) {
														esv.names.push(n + '_g');
													}
													if (rgb & 0b001) {
														esv.names.push(n + '_b');
													}
												} else if (e.type === outputType.onlineGraph) {
													esv.names = [];
													n += '_var';
													for (let i = 1; i <= e.valuesCount; i++) {
														esv.names.push(n + i);
													}
												}
											} else if (e.category === category.input && e.type === inputType.joystick) {
												esv.names = [];
												esv.names.push(n + '_x');
												esv.names.push(n + '_y');
											}
										}
										++j;
									} else {
										error = true;
										break;
										//return { error: "Element-Struct type mismatch: type is " + esv.type + ", expected " + sv.type + "." };
									}
								} else {
									esv.names = [];
									let i = 0;
									for (; i < esv.size; i++) {
										if (esv.type === sv.type || esv.type2 === sv.type) {
											esv.names.push(sv.name);
											sv = s.variables[++j];
										} else {
											error = true;
											//return { error: "Element-Struct type mismatch: type is " + esv.type + ", expected " + sv.type + "." };
											break;
										}
									}
									if (i === esv.size) {
										esv.name = esv.names[0].match('^([^]+)+(?:_x|_r|_g|_b|(?:_var\\d+))$')[1];
									} else {
										error = true;
										//return { error: "Element-Struct size mismatch: size is " + esv.size + ", expected " + i + "." };
										break;
									}
								}
							}
						}

						if (i !== elements.length) {
							error = true;
							//return { error: "Elements-Struct size mismatch: size is " + i + ", expected " + elements.length + "." };
						}

						if (!error) {
							a.structId = si;
							s.arrayId = ai;
							s.otherVarsIdx = j;
							parsedData.push({ array: a, struct: s });
						}
					}
				}
			}
		}

		console.log('Parser finished\n\n');

		if (parsedData.length > 0) {
			formatter(title, content, parsedData);
		}
	}
};

export { parser, category, inputType, outputType, decorationType };
