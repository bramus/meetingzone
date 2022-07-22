#!/usr/bin/env node

import { argv, exit } from 'node:process';
import { Temporal } from '@js-temporal/polyfill';
import { table, getBorderCharacters } from 'table';
import clc from 'cli-color';

let when = 'now',
	whenInstant = null,
	identifiers = [];

const timezones = [],
	ignoredIdentifiers = [],
	data = [],
	userTz = Temporal.Now.timeZone();

// Assign CLI args to variables
if (argv.length > 2) {
	// Extract all identifiers
	identifiers = argv.slice(2, argv.length);

	// Try and parse last identifier to a TZ. If that fails, assume it’s a passed in date
	try {
		const tz = Temporal.TimeZone.from(identifiers[identifiers.length - 1]);
	} catch (e) {
		when = identifiers.pop();
	}
}

// Support 'now' as a string argument for when
if (when === 'now') {
	when = Temporal.PlainDate.from(Temporal.Now.plainDateTimeISO());
}

// No identifiers? Use this default set.
if (!identifiers.length) {
	identifiers = ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Brussels'];
}

// Make sure UTC is first
identifiers = identifiers.filter((i) => i !== 'UTC');
identifiers.unshift('UTC');

// @TODO: Sort non-UTC by offset (?)

// Parse `when` to an Instant. Assume local timezone.
try {
	whenInstant = Temporal.PlainDateTime.from(when).toZonedDateTime(userTz).toInstant();
} catch (e) {
	console.error(clc.red(`ERROR: Could not parse “${when}” to a Date or TimeZone.`));
	exit(1);
}

// Convert identifiers to TimeZone instances
for (const identifier of identifiers) {
	try {
		const tz = Temporal.TimeZone.from(identifier);
		timezones.push(tz);
	} catch (e) {
		ignoredIdentifiers.push(identifier);
	}
}

// Add TZ headers to table
data.push(timezones.map((tz) => (tz.toString() == userTz.toString() ? clc.bold.underline(tz.toString()) : clc.bold(tz.toString()))));

for (let i = 0; i < 24; i++) {
	data.push(
		timezones.map((tz) => {
			// Adjust the whenInstant to the given timezone
			const whenAdjusted = whenInstant.add({ hours: i }).toZonedDateTime({
				calendar: Temporal.Calendar.from('iso8601'),
				timeZone: tz,
			});

			// Determine which color to use, based on the hour of the day (not for UTC)
			let colorize = (input) => input;
			if (tz.toString() != 'UTC') {
				const hourOfTheDay = parseInt(whenAdjusted.toLocaleString('be-NL', { hour: '2-digit' }));
				colorize = clc.red;
				if ([9, 10, 11, 12, 13, 14, 15, 16, 17].includes(hourOfTheDay)) {
					colorize = clc.green;
				}
				if ([7, 8, 18, 19, 20, 21].includes(hourOfTheDay)) {
					colorize = clc.yellow;
				}
			}

			//@TODO: Mark weekends as no-go

			// ZonedDateTime should really offer a format method ...
			return `${colorize(`${whenAdjusted.toPlainDate()} ${whenAdjusted.toPlainTime()} ${whenAdjusted.getISOFields().offset}`)}`;
			// return colorize(whenAdjusted.toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset', hourCycle: 'h23' }));
		})
	);
}

const config = {
	// Only draw horizontal lines around the headers and table itself
	drawHorizontalLine: (lineIndex, rowCount) => {
		return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount;
	},
	// Markdown-like borders
	border: getBorderCharacters('ramac'),
};

// Output!
console.log(table(data, config));
if (ignoredIdentifiers.length) {
	console.warn(clc.xterm(178)(`WARN: Ignored identifiers “${ignoredIdentifiers.join('”, “')}” as they could not be parsed to a proper timezone`));
}
