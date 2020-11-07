import tippy from 'tippy.js';
import 'tippy.js/animations/scale.css';

tippy.setDefaultProps({
	arrow: false,
	theme: 'custom',
	placement: 'right',
	delay: [500, 0],
	maxWidth: 200,
	animation: 'scale',
	touch: true,
});

const tooltips = [];

const createTooltip = (e, t, o) => {
	const tt = tippy(e, { content: t, ...o });
	tooltips.push(tt);
	return tt;
};

const toggleTooltips = (b) => {
	if (b === true) {
		for (const t of tooltips) {
			t.enable();
		}
	} else {
		for (const t of tooltips) {
			t.disable();
		}
	}
};

export { createTooltip, toggleTooltips };
