// Calendar dates (move-in, start, end) are stored as DATE columns in UTC midnight.
// "Today" is calculated in Bangladesh time so that date rules match the user's calendar.

const TIME_ZONE = "Asia/Dhaka";
const DAY_MS = 24 * 60 * 60 * 1000;

const todayString = () =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());

const fromDateString = (value: string) => new Date(`${value}T00:00:00.000Z`);

const today = () => fromDateString(todayString());

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export const dateUtils = {
	todayString,
	fromDateString,
	today,
	addDays,
	addHours,
	toDateString,
	startOfMonth,
};
