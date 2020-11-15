import JSONFormatter from 'json-formatter-js';

const consoleElement = document.getElementById('console');

for (const f of ['log', 'debug', 'info', 'warn', 'error', 'json']) {
	console[f] = ((method, f) => {
		return function () {
			let div;
			if (f === 'json') {
				const tree = new JSONFormatter(
					arguments[0],
					2,
					{
						theme: 'custom',
						animateOpen: false,
						animateClose: false,
						//sortPropertiesBy: (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
					},
					arguments[1],
				);
				div = tree.render();
			} else {
				method.apply(console, arguments);
				div = document.createElement('div');
				if (f === 'info') {
					div.style.color = 'rgb(50,150,250)';
				} else if (f === 'error') {
					div.style.color = 'rgb(255,128,128)';
				} else if (f === 'warn') {
					div.style.color = 'rgb(255,165,0)';
				}
				div.classList.add(f);
				div.textContent = Array.prototype.slice.call(arguments).join(' ');
			}
			consoleElement.appendChild(div);
			consoleElement.scrollIntoView(false);
		};
	})(console[f], f);
}

const clearConsole = () => {
	consoleElement.textContent = '';
};

const copyConsole = () => {
	if (consoleElement.textContent !== '') {
		navigator.permissions.query({ name: 'clipboard-write' }).then((r) => {
			if (r.state === 'granted') {
				navigator.clipboard.writeText(consoleElement.innerText).then(
					() => console.info('Console has been copied to clipboard.\n\n'),
					() => console.warn('Failed to copy console to clipboard...\n\n'),
				);
			} else {
				console.warn('Permission "clipboard-write" denied...\n\n');
			}
		});
	}
};

const scrollConsoleToBottom = () => {
	consoleElement.scrollIntoView(false);
};

export { clearConsole, copyConsole, scrollConsoleToBottom };
