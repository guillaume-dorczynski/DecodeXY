import jszip from 'jszip/dist/jszip.min';
import { parser } from './parser.js';
import { allowedFileTypes } from './view.js';
/*
const loadContents = (t, c) => {
	if (c.kind) {
		if (c.kind === 'string') {
			c.getAsString((s) => loadContent(s, n));
			return;
		} else if (c.kind === 'file') {
			loadContent(c.getAsFile());
			return;
		}
	}
};

let loadedContents = [];*/
/*
let loadedContent;
const resetContent = () => {
	loadedContent = undefined;
};

const getLoadedContent = () => {
	return loadedContent;
};

const parseContent = () => {
	if (loadedContent) {
		parser(loadedContent.name, loadedContent.content);
	}
};*/

const loadContent = (c, n) => {
	if (c.kind) {
		if (c.kind === 'string') {
			c.getAsString((s) => loadContent(s, n));
			return;
		} else if (c.kind === 'file') {
			loadContent(c.getAsFile());
			return;
		}
	}

	if (typeof c === 'string') {
		if (n === 'd') {
			n = 'Dropped text';
		} else if (n === 'p') {
			n = 'Pasted text';
		}
		console.log('loadContent: loading a string named ' + n + ':\n' + c);
		//loadedContent = { name: n, content: c };
		parser(n, c);
		//parseContent();
	} else if (c instanceof File) {
		if (c.size > 100000000) {
			console.log('File ' + c.name + ' is too big!');
		} else {
			const reSplitFileName = new RegExp('(.+)\\.([^.]+)', '');
			const r = c.name.match(reSplitFileName);
			if (r && r[2] === 'zip') {
				jszip.loadAsync(c).then(
					(zip) => {
						let found = false;
						zip.forEach((p, zf) => {
							if (zf.dir === false) {
								const r = zf.name.match(reSplitFileName);
								if (r && r[2] && r[2] !== 'zip' && allowedFileTypes[r[2]]) {
									found = true;
									zf.async('string').then((data) => {
										loadContent(data, c.name + '/' + zf.name);
									});
								}
							}
						});
						if (found === false) {
							console.error('No valid file found');
						}
					},
					(e) => {
						console.log('Error reading ' + c.name + ': ' + e.message);
					},
				);
			} else if (allowedFileTypes[r[2]]) {
				const fr = new FileReader();
				fr.readAsText(c);
				fr.onload = (e) => {
					loadContent(e.target.result, c.name);
				};
				fr.onerror = () => {
					console.log('FileReader error: ' + fr.error);
					fr.abort();
				};
				fr.onabort = () => {
					console.log('FileReader aborted');
				};
			}
		}
	} else {
		console.log('loadContent: Unknown content type...' + c);
	}
};

//const loadString = () => {};
export { loadContent }; //, parseContent, getLoadedContent, resetContent }; //, loadFile, loadString };
