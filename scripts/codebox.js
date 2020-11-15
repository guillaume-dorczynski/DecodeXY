import hljs from 'highlight.js/lib/core.js';
import clike from 'highlight.js/lib/languages/c-like.js';
import cpp from 'highlight.js/lib/languages/cpp.js';
import arduino from 'highlight.js/lib/languages/arduino.js';
import 'highlight.js/styles/vs2015.css';

hljs.registerLanguage('c-like', clike);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('arduino', arduino);

const codeBox = document.getElementById('codeBox');
const codeTitle = document.getElementById('codeTitle');
const bigButton = document.getElementById('bigButton');

let codeText = '';

const setCode = (title, code) => {
	codeText = code;
	codeBox.textContent = code;
	codeTitle.textContent = title || '';
	bigButton.hidden = true;
	hljs.highlightBlock(codeBox);
};

const copyCode = () => {
	if (codeText !== '') {
		navigator.permissions.query({ name: 'clipboard-write' }).then((r) => {
			if (r.state === 'granted') {
				navigator.clipboard.writeText(codeText).then(
					() => {
						console.info('Code has been copied to clipboard.\n\n');
					},
					() => {
						console.warn('Failed to copy code to clipboard...\n\n');
					},
				);
			} else {
				console.warn('Permission "clipboard-write" denied...\n\n');
			}
		});
	}
};

const downloadCode = () => {
	let e = document.createElement('a');
	e.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(codeText));
	e.setAttribute('download', codeTitle.textContent);
	e.style.display = 'none';
	document.body.appendChild(e);
	e.click();
	document.body.removeChild(e);
};

const resetCode = () => {
	codeText = '';
	codeBox.textContent = '';
	codeTitle.textContent = 'No project loaded';
	bigButton.hidden = false;
};

export { setCode, copyCode, downloadCode, resetCode };
