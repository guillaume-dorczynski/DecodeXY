import { formatter } from './formatter.js';
import treeify from 'treeify';

// Regex to remove comments
// prettier-ignore
const reComment = new RegExp(
	"(?:\\/\\*[^]*?\\*\\/)" + // search "/*" and any characters until "*/"
	"|" +                     // or
	"(?:\\/\\/.*)",           // search "//" and any characters until line terminator
	"g",
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
	"g",
);

// Regex to extract array content, validating numbers from -255 to 255 and any characters such as 'C' or '\n'
// prettier-ignore
const reArrayData = new RegExp(
	"-?\\b(?:" +    // optional "-", assert word boundary, followed by...
	"[0-9]" +       // a single digit, 0 to 9
	"|" +           // or
	"[1-9][0-9]" +  // two digits, 10 to 99
	"|" +           // or
	"1[0-9][0-9]" + // three digits, 100 to 199
	"|" +           // or
	"2[0-4][0-9]" + // three digits, 200 to 249
	"|" +           // or
	"25[0-5]" +     // three digits, 250 to 255
	")\\b" +        // assert word boundary
	"|" +           // or if it's not a number from -255 to 255,
	"'\\\\?.?'",    // search a (possibly escaped) character between ' '
	"g",
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
	"\\s+([^\\s]+?)" +                               // skip at least one whitespace, capture variable-name (group 2)
	"\\s*(?:\\[\\s*(\\d+)\\s*\\])?\\s*\\;",          // skip any whitespaces, try capture variable-size (group 3) between [], until any whitespaces and ";"
	"g",
);

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

const textAtPos = (a, p) => {
	let i = p;
	let n = undefined;
	let c = undefined;
	let an = [];
	let ac = [];

	while (a[i] !== '0' && a[i] !== "'\\0'") {
		n = Number(a[i]);
		if (isNaN(n)) {
			c = a[i].match(/'([^])'/)[1];
			if (c) {
				n = c.charCodeAt(0);
				a[i] = n.toString();
			}
		} else {
			c = String.fromCharCode(n);
		}
		an.push(n);
		ac.push(n > 127 ? a[i] : "'" + c + "'");
		i++;
	}

	if (a[i] === "'\\0'") {
		a[i] = '0';
	}

	return {
		text: new TextDecoder('utf-8').decode(Uint8Array.from(an)),
		chars: ac,
		startPos: p,
		endPos: i,
	};
};

const parser = (title, content) => {
	let c = content;
	let parsedData = [];
	let arrays = [];
	let structs = [];

	console.log('Removing comments...\n');
	c = c.replace(reComment, (m) => ' '.repeat(m.length));

	console.log('Searching structs...\n');
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
		console.warn("Couldn't find any struct!\n");
		return;
	} else {
		console.info('Found ' + structsLenght + ' struct' + (structsLenght > 1 ? 's.\n' : '.\n'));
	}

	console.log('Searching arrays...\n');
	const headerSize = 10;
	for (const m of c.matchAll(reArray)) {
		if (m[3]) {
			let i = 0;
			const v = [];
			const n = [];

			for (const m2 of m[3].matchAll(reArrayData)) {
				v[i] = m2[0];
				n[i] = Number(v[i]);
				i++;
			}

			if (i >= headerSize && n[0] === 255 && n[7] === headerSize && i === ((n[6] << 8) | n[5]) + 7) {
				const a = {
					startPos: m.index,
					endPos: m.index + m[0].length,
					name: m[1],
					size: m[2] ? Number(m[2]) : -1,
					header: {
						values: [],
						totalInputs: (n[2] << 8) | n[1],
						totalOutputs: (n[4] << 8) | n[3],
						totalBytes: i - headerSize,
						backgroundColor: n[8],
						flags: {
							viewOrientation: n[9] & 0b00000011,
							pagesEnabled: (n[9] & 0b00000100) >> 2,
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

				let j = 0;
				while (j < headerSize) {
					a.header.values[j] = v[j++];
				}
				while (j < i - 1) {
					const e = {
						startPos: j,
						endPos: 0,
						category: n[j] >> 6,
						type: n[j] & 0b00001111,
						values: [],
						bytes: [],
						lines: [],
						id: n[j],
						flags: n[++j],
						x1: n[++j],
						y1: n[++j],
						w1: n[++j],
						h1: n[++j],
					};
					if (a.header.flags.viewOrientation === viewOrientation.both) {
						e.x2 = n[++j];
						e.y2 = n[++j];
						e.w2 = n[++j];
						e.h2 = n[++j];
					}
					if (a.header.flags.pagesEnabled === 1) {
						e.pageId = n[++j];
					}
					switch (e.category) {
						case category.input: {
							switch (e.type) {
								case inputType.button: {
									e.shape = e.flags & 0b00000011;
									e.borderStyle = (e.flags & 0b00001100) >> 2;
									e.backgroundColor = n[++j];
									e.textColor = n[++j];
									e.texts = [textAtPos(v, ++j)];
									j = e.texts[0].endPos;
									e.structVar = { type: 'uint8_t', size: 1, type2: 'bool' };
									a.elements.inputs.buttons.push(e);
									break;
								}
								case inputType.switch: {
									e.shape = e.flags & 0b00000011;
									e.buttonColor = n[++j];
									e.backgroundColor = n[++j];
									e.textOnColor = n[++j];
									e.textOffColor = n[++j];
									e.texts = [];
									e.texts[0] = textAtPos(v, ++j);
									e.texts[1] = textAtPos(v, e.texts[0].endPos + 1);
									j = e.texts[1].endPos;
									e.structVar = { type: 'uint8_t', size: 1, type2: 'bool' };
									a.elements.inputs.switches.push(e);
									break;
								}
								case inputType.select: {
									e.optionsCount = e.flags & 0b00000111;
									e.orientation = (e.flags & 0b10000000) >> 7;
									e.buttonColor = n[++j];
									e.backgroundColor = n[++j];
									e.structVar = { type: 'uint8_t', size: 1 };
									a.elements.inputs.selects.push(e);
									break;
								}
								case inputType.slider: {
									e.alwaysCenter = (e.flags & 0b00010000) >> 4;
									e.centerPosition = (e.flags & 0b01100000) >> 5;
									e.orientation = (e.flags & 0b10000000) >> 7;
									e.buttonColor = n[++j];
									e.backgroundColor = n[++j];
									e.structVar = { type: 'int8_t', size: 1 };
									a.elements.inputs.sliders.push(e);
									break;
								}
								case inputType.joystick: {
									e.buttonsPositions = e.flags & 0b00011111;
									e.automaticCenter = (e.flags & 0b00100000) >> 5;
									e.buttonColor = n[++j];
									e.backgroundColor = n[++j];
									e.textColor = n[++j];
									e.structVar = { type: 'int8_t', size: 2 };
									a.elements.inputs.joysticks.push(e);
									break;
								}
								case inputType.colorPicker: {
									e.buttonColor = n[++j];
									e.backgroundColor = n[++j];
									e.structVar = { type: 'uint8_t', size: 3 };
									a.elements.inputs.colorPickers.push(e);
									break;
								}
								case inputType.editField: {
									e.alignment = e.flags & 0b00000011;
									e.showBackground = (e.flags & 0b00000100) >> 2;
									e.inputType = (e.flags & 0b00011000) >> 3;
									e.showClearButton = (e.flags & 0b00100000) >> 5;
									e.textColor = n[++j];
									e.backgroundColor = n[++j];
									e.buttonColor = n[++j];
									if (e.inputType === 0b00) {
										e.maxTextLength = n[++j];
										e.structVar = { type: 'char', size: e.maxTextLength };
									} else if (e.inputType === 0b01) {
										e.maxDecimals = n[++j];
										e.structVar = { type: 'float', size: 1 };
									} else if (e.inputType === 0b10) {
										e.structVar = { type: 'int16_t', size: 1 };
									}
									a.elements.inputs.editFields.push(e);
									break;
								}
								default: {
									break;
								}
							}
							a.elements.inputs.all.push(e);
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
									a.elements.outputs.leds.push(e);
									break;
								}
								case outputType.level: {
									e.levelType = e.flags & 0b00000111;
									e.centerPosition = (e.flags & 0b01100000) >> 5;
									e.orientation = (e.flags & 0b10000000) >> 7;
									e.color = n[++j];
									e.backgroundColor = n[++j];
									e.structVar = { type: 'int8_t', size: 1 };
									a.elements.outputs.levels.push(e);
									break;
								}
								case outputType.textString: {
									e.alignment = e.flags & 0b00000011;
									e.showBackground = (e.flags & 0b00000100) >> 2;
									e.textColor = n[++j];
									e.backgroundColor = n[++j];
									e.maxTextLength = n[++j];
									e.structVar = { type: 'char', size: e.maxTextLength };
									a.elements.outputs.textStrings.push(e);
									break;
								}
								case outputType.onlineGraph: {
									e.valuesCount = e.flags & 0b00001111;
									e.showValues = (e.flags & 0b00010000) >> 4;
									e.showLegends = (e.flags & 0b00100000) >> 5;
									e.backgroundColor = n[++j];
									e.structVar = { type: 'float', size: e.valuesCount };
									e.colors = [];
									for (let i = 0; i < e.valuesCount; i++) {
										e.colors[i] = n[++j];
									}
									if (e.showLegends === 1) {
										e.texts = [];
										for (let i = 0; i < e.valuesCount; i++) {
											e.texts[i] = textAtPos(v, ++j);
											j = e.texts[i].endPos;
										}
									}
									a.elements.outputs.onlineGraphs.push(e);
									break;
								}
								case outputType.sound: {
									e.hide = e.flags & 0b00000001;
									e.structVar = { type: 'int16_t', size: 1 };
									if (e.hide === 0) {
										e.color = n[++j];
									}
									a.elements.outputs.sounds.push(e);
									break;
								}
								default: {
									break;
								}
							}
							a.elements.outputs.all.push(e);
							if (e.structVar.size > 0) {
								a.elements.totalOutputs += e.structVar.size * sizeOfType[e.structVar.type];
							}
							break;
						}
						case category.decoration: {
							switch (e.type) {
								case decorationType.label: {
									e.labelId = a.elements.decorations.labels.length + 1;
									e.textColor = n[++j];
									e.texts = [textAtPos(v, ++j)];
									j = e.texts[0].endPos;
									a.elements.decorations.labels.push(e);
									break;
								}
								case decorationType.panel: {
									e.panelId = a.elements.decorations.panels.length + 1;
									e.bevel = e.flags & 0b00000011;
									e.color = n[++j];
									a.elements.decorations.panels.push(e);
									break;
								}
								case decorationType.page: {
									e.isMainPage = e.flags & 0b00000001;
									e.border = (e.flags & 0b00000110) >> 1;
									e.backgroundColor = n[++j];
									e.textColor = n[++j];
									e.texts = [textAtPos(v, ++j)];
									j = e.texts[0].endPos;
									a.elements.decorations.pages.push(e);
									break;
								}
								default: {
									break;
								}
							}
							a.elements.decorations.all.push(e);
							break;
						}
						default: {
							break;
						}
					}
					e.endPos = j++;
					for (let i = 0, j = e.startPos; j <= e.endPos; i++, j++) {
						e.values[i] = v[j];
						e.bytes[i] = n[j];
					}
					a.elements.totalBytes += e.values.length;
					a.elements.all.push(e);
				}
				if (i === j && a.elements.totalInputs === a.header.totalInputs && a.elements.totalOutputs === a.header.totalOutputs) {
					arrays.push(a);
				}
			}
		}
	}

	const arraysLenght = arrays.length;
	if (arraysLenght === 0) {
		console.warn("Couldn't find any arrays! Aborting...\n");
		return;
	} else {
		console.info('Found ' + arraysLenght + ' array' + (arraysLenght > 1 ? 's.\n' : '.\n'));
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
							const e = elements[i];
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
							console.log('Array "' + a.name + '" matched with Struct "' + s.objectName + '"\n');
							parsedData.push({ array: a, struct: s });
						}
					}
				}
			}
		}

		if (parsedData.length > 0) {
			formatter(title, content, parsedData);
			console.json(parsedData, 'parsedData');
		}
	}
};

export { parser, category, inputType, outputType, decorationType };
