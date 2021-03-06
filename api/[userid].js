const path = require("path");
const fs = require("fs");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const fetch = require('node-fetch');
const queryString = require('query-string');

dayjs.extend(utc);
dayjs.extend(timezone);

const userToken = process.env.FITBIT_USER_TOKEN;

/**Fakes a sleep log in FitBit to get the past X ms sleep data
 * NOTE: That FitBit does not allow for overlapping sleep logs to be created so
 * this has the potential to fail (if a sleep log was recorded in the last
 * durationMS) or cause FitBit to not be able to record a normal sleep log
 * NOTE: This is basically just an indicator for lack of movement. I sat at my
 * desk all day and when pulling up this data, it mostly thought I was asleep.
 * So you're going to need to use heart rate too to be extra sure
 * @param {string} userId The FitBit user id
 * @param {number} durationMS The duration to check into the past in milliseconds
 * @returns {object} The Sleep  record as defined in the FitBit API (the .sleep key).
 * See https://dev.fitbit.com/build/reference/web-api/sleep/#log-sleep
 */
async function fakeSleepLog(userId, durationMS) {
  const startDate = dayjs.tz().subtract(durationMS, 'ms');
  const qs = queryString.stringify({
    date: startDate.format('YYYY-MM-DD'),
    startTime: startDate.format('HH:mm'), // 24hr time, from docs it says HH:mm (and how else would it get AM/PM without 24hr?)
    duration: durationMS
  });
  const resp = await fetch(`https://api.fitbit.com/1.2/user/${userId}/sleep.json?${qs}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });
  if (!resp.ok) {
    console.error(resp);
    throw new Error('Log sleep call failed.');
  }
  const { sleep } = await resp.json();
  //console.log(sleep);
  const resp2 = await fetch(`https://api.fitbit.com/1.2/user/${userId}/sleep/${sleep.logId}.json`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });
  if (!resp2.ok) {
    console.error(resp2);
    throw new Error(`Delete sleep logId ${sleep.logId} failed.`);
  }

  return sleep;
}

async function getIntradayHeartRate(userId, durationMS) {
  const endDate = dayjs.tz();
  const startDate = endDate.subtract(durationMS, 'ms');
  const qs = queryString.stringify({
    date: startDate.format('YYYY-MM-DD'),
    startTime: startDate.format('HH:mm'), // 24hr time, from docs it says HH:mm (and how else would it get AM/PM without 24hr?)
    duration: durationMS
  });
  const startDay = startDate.format('YYYY-MM-DD');
  const endDay = endDate.format('YYYY-MM-DD');
  const startTime = startDate.format('HH:mm');
  const endTime = endDate.format('HH:mm');
  const detailLevel = '1min';
  const resp = await fetch(`https://api.fitbit.com/1/user/${userId}/activities/heart/date/${startDay}/${endDay}/${detailLevel}/time/${startTime}/${endTime}.json`, {
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });
  if (!resp.ok) {
    console.error(resp);
    throw new Error('Heart rate intra day failed.');
  }

  const json = await resp.json();
  return json["activities-heart-intraday"];
}

async function getUserProfile(userId) {
  const resp = await fetch(`https://api.fitbit.com/1/user/${userId}/profile.json`, {
    headers: {
      Authorization: `Bearer ${userToken}`
    }
  });
  if (!resp.ok) {
    console.error(resp);
    throw new Error('User profile get failed.');
  }

  const { user } = await resp.json();
  return user;
}

/**Checks if userId is asleep or awake
 * @param {string} userId The FitBit user id
 * @param {number} mins The past amount of minutes to check
 * @returns {string} "asleep" or "awake"
 */
async function getCurrentSleepStatus(userId, mins) {
  // Get sleep/movement data (see notes in fakeSleepLog)
  const { minutesAsleep, minutesAwake } = await fakeSleepLog(userId, mins * 60 * 1000); //15 minutes of data
  const percentageMarkedAsleep = (minutesAsleep - minutesAwake) / mins;

  // Get heart rate
  const sleepingHeartRate = 58;
  const { dataset } = await getIntradayHeartRate(userId, mins * 60 * 1000);
  const averageHeartRate = dataset
    .map(d => d.value)
    .reduce((acc, itm) => acc + itm, 0) / dataset.length;

  console.log(`Updated with: Sleep Movement ${percentageMarkedAsleep} | Avg Heart Rate ${averageHeartRate} `);

  if (percentageMarkedAsleep > 0.85 && averageHeartRate < sleepingHeartRate) { // At least 85% was asleep (little movement)
    return "asleep";
  }
  return "awake";
}

const lastFetch = {
  time: undefined,
  userTimezone: undefined,
  sleepStatus: undefined
};
module.exports = async (req, res) => {
  const { userid } = req.query;

  if (!userToken) {
    res.write('Vercel variable FITBIT_USER_TOKEN not set.')
    res.end();
    return;
  }

  let style = "flat";
  if (
    req.query.style === "flat" ||
    req.query.style === "flat-square" ||
    req.query.style === "for-the-badge" ||
    req.query.style === "plastic"
  ) {
    style = req.query.style;
  }

  // Get all timezone information so we're claculating the proper times for "now"
  // even when the user is in a different timezone
  const localTimezone = dayjs.tz.guess();
  console.log(`Server timezone is ${localTimezone}`);

  if (!lastFetch.userTimezone) {
    const { timezone } = await getUserProfile(userid);
    lastFetch.userTimezone = timezone;
  }
  console.log(`User timezone is ${lastFetch.userTimezone}`);
  dayjs.tz.setDefault(lastFetch.userTimezone);

  // Get the fitbit sleep status (only every 15 minutes)
  let sleepStatus = lastFetch.sleepStatus;
  const now = Date.now();
  if (!lastFetch.time || !lastFetch.sleepStatus ||
    ((now - lastFetch.time) > 15 * 60 * 1000)) {
    // If no last fetch time, last fetch status, or it's been 15 mins, refetch
    try {
      sleepStatus = lastFetch.sleepStatus = await getCurrentSleepStatus(userid, 15);
      lastFetch.time = now;
    }
    catch(e) {
      console.error(e);
      sleepStatus = undefined;
    }
  }

  // Output the svg
  res.setHeader("Content-Type", "image/svg+xml");
  return fs
    .createReadStream(
      path.join(__dirname, `../assets/${style}/${sleepStatus || 'error'}.svg`)
    )
    .pipe(res);
};