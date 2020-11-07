const embeddedConsole = document.getElementById('console');

for (const verb of ['log', 'debug', 'info', 'warn', 'error']) {
	console[verb] = ((method, verb, log) => {
		return function () {
			method.apply(console, arguments);
			var msg = document.createElement('div');
			if (verb === 'info') {
				msg.style.color = 'rgb(50,150,250)';
			}
			if (verb === 'error') {
				msg.style.color = 'rgb(255,128,128)';
			}
			msg.classList.add(verb);
			msg.innerText = Array.prototype.slice.call(arguments).join(' ');
			log.appendChild(msg);
			log.scrollIntoView(false);
		};
	})(console[verb], verb, embeddedConsole);
}

const isPrintable = (char) => {
	/*eslint-disable-next-line no-control-regex*/
	return !RegExp('[\\x00-\\x08\\x0E-\\x1F\\x80-\\xFF]').test(char);
};

const clearConsole = () => {
	embeddedConsole.innerText = '';
};

const copyConsole = () => {
	const e = document.getElementById('hiddenTextArea');
	e.value = embeddedConsole.innerText;
	e.select();
	document.execCommand('copy');
	e.value = '';
	console.info('Console has been copied to clipboard.');
};

const scrollConsoleToBottom = () => {
	embeddedConsole.scrollIntoView(false);
};

export { clearConsole, copyConsole, scrollConsoleToBottom };
