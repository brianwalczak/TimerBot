const { DateTime } = require('luxon');

function getMsDuration({ hours = 0, minutes = 0, seconds = 0 }) {
  return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
}

function createTimeString({ hours = 0, minutes = 0, seconds = 0 }) {
	const formattedTime = [
		hours ? `${hours}h` : null,
		minutes ? `${minutes}m` : null,
		seconds ? `${seconds}s` : null
	].filter(Boolean).join(' ');

	return formattedTime || '0s';
}

function createDateTimeString(ms, tz = 'UTC') {
  if (!ms || isNaN(ms)) return 'Unknown time';

  try {
    return DateTime.fromMillis(Number(ms)).setZone(tz).toFormat('LLLL d, yyyy h:mm a');
  } catch (err) {
    return DateTime.fromMillis(Number(ms)).toUTC().toFormat('LLLL d, yyyy h:mm a');
  }
}

module.exports = { getMsDuration, createTimeString, createDateTimeString };