// Astronomical constants for Rome
const ROME_LATITUDE = (41.9 * Math.PI) / 180; // 41.9°N in radianti
const ROME_LONGITUDE = (12.5 * Math.PI) / 180; // 12.5°E in radianti

/**
 * Simplified equation of time in minutes.
 * @param {number} dayOfYear - Day of the year (1–365).
 * @returns {number} Time correction in minutes.
 */
export function equationOfTime(dayOfYear) {
  const B = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}
/**
 * Calculates the solar declination angle for a given day.
 * @param {number} dayOfYear - Day of the year (1–365).
 * @returns {number} Declination angle in radians.
 */
export function solarDeclination(dayOfYear) {

  return (
    ((23.45 * Math.PI) / 180) *
    Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365)
  );
}
/**
 * Converts hour angle to azimuth angle.
 * @param {number} hourAngle - Hour angle in radians.
 * @param {number} declination - Solar declination in radians.
 * @param {number} latitude - Observer's latitude in radians.
 * @returns {number} Azimuth angle in radians.
 */
export function hourAngleToAzimuth(hourAngle, declination, latitude) {
  
  const sinAz =
    (Math.sin(hourAngle) * Math.cos(declination)) /
    Math.cos(
      Math.asin(
        Math.sin(declination) * Math.sin(latitude) +
          Math.cos(declination) * Math.cos(latitude) * Math.cos(hourAngle)
      )
    );
  return Math.asin(sinAz);
}
/**
 * Calculates the angles of hour lines for a horizontal sundial.
 * @param {number} latitude - Latitude in radians.
 * @returns {Array<{hour: number, angle: number, displayHour: number}>}
 */
export function calculateSundialHourAngles(latitude) {
  const hourAngles = [];
  for (let hour = 6; hour <= 18; hour++) {

    const hourAngle = ((hour - 6) * 15 * Math.PI) / 180 + Math.PI / 2;
    hourAngles.push({
      hour: hour,
      angle: hourAngle,
      displayHour: hour,
    });
  }
  return hourAngles;
}
/**
 * Converts a day of the year to a readable date string (e.g. "21 Mar").
 * @param {number} day - Day of year (1–365).
 * @returns {string} Date string.
 */
export function dayOfYearToDateString(day) {
  const months = [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ];
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let month = 0;
  let dayInMonth = day;

  while (dayInMonth > daysInMonth[month]) {
    dayInMonth -= daysInMonth[month];
    month++;
  }

  return `${dayInMonth} ${months[month]}`;
}

/**
 * Computes the apparent time based on solar azimuth and elevation.
 * @param {number} azimuth - Sun azimuth in degrees.
 * @param {number} elevation - Sun elevation in degrees.
 * @param {number} dayOfYear - Day of year (1–365).
 * @returns {string} Time string or message ("Night", "Sun not visible", etc.)
 */
export function calculateTimeFromSun(azimuth, elevation, dayOfYear) {

  if (elevation <= 0) return "Notte";

  if (azimuth > 270 || azimuth < 90) return "Sole non visibile";

  let solarHour = (azimuth - 90) / 15 + 6;


  const eot = equationOfTime(dayOfYear);
  const civilTime = solarHour - eot / 60;

  const hours = Math.floor(civilTime);
  const minutes = Math.floor((civilTime - hours) * 60);

  if (hours < 6 || hours > 17) return "Fuori orario";

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Computes the time based on the shadow direction.
 * @param {number[]} lightDirection - [x, y, z] sun direction vector.
 * @param {number} dayOfYear - Day of year (1–365).
 * @returns {string} Time string or "Night"/"Out of range".
 */
export function calculateShadowTime(lightDirection, dayOfYear) {
  if (lightDirection[1] >= -0.01) return "Notte";

 
  const shadowAngle = Math.atan2(lightDirection[0], -lightDirection[2]);


  const hourAngles = calculateSundialHourAngles(ROME_LATITUDE);
  let closestHour = 12;
  let minDiff = Math.PI;

  hourAngles.forEach((hourData) => {
    const diff = Math.abs(shadowAngle - hourData.angle);
    if (diff < minDiff) {
      minDiff = diff;
      closestHour = hourData.hour;
    }
  });


  const exactHour = 12 - (shadowAngle * 6) / (Math.PI / 2);

  const eot = equationOfTime(dayOfYear);
  const civilTime = exactHour - eot / 60;

  const hours = Math.floor(civilTime);
  const minutes = Math.floor((civilTime - hours) * 60);

  if (hours < 6 || hours > 17) return "Fuori orario"; // Estendi fino alle 20

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}
