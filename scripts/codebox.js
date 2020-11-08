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
const hiddenTextArea = document.getElementById('hiddenTextArea');
const bigButton = document.getElementById('bigButton');

let codeText;
const setCode = (title, code) => {
	codeText = code;
	codeBox.textContent = code;
	codeTitle.textContent = title || '';
	bigButton.hidden = true;
	hljs.highlightBlock(codeBox);
};

const copyCode = () => {
	hiddenTextArea.value = codeText; //codeBox.textContent;
	hiddenTextArea.select();
	document.execCommand('copy');
	hiddenTextArea.value = '';
	console.info('Code has been copied to clipboard.');
};

/*const downloadCode = () => {
	let e = document.createElement('a');
	e.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(codeBox.textContent));
	e.setAttribute('download', codeTitle.textContent);
	e.style.display = 'none';
	document.body.appendChild(e);
	e.click();
	document.body.removeChild(e);
};*/

const downloadCode = () => {
	var data = new Blob([codeBox.innerText], { type: 'text/plain' });

	var url = window.URL.createObjectURL(data);

	let e = document.createElement('a');
	e.href = url;
	//e.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(codeBox.textContent));
	e.setAttribute('download', codeTitle.textContent);
	e.style.display = 'none';
	document.body.appendChild(e);
	e.click();
	document.body.removeChild(e);
};

const resetCode = () => {
	codeBox.textContent = '';
	codeTitle.textContent = 'No project loaded';
	bigButton.hidden = false;
	console.log('Ready');
};

export { setCode, copyCode, downloadCode, resetCode };
