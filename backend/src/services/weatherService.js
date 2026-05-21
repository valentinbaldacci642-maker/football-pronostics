// Lightweight Open-Meteo client for weather push alerts. Free, no key.
const axios = require('axios');

const client = axios.create({ baseURL: 'https://api.open-meteo.com/v1', timeout: 10000 });

// Next-hours precipitation/storm outlook for a point.
async function getOutlook(lat, lon) {
  const { data } = await client.get('/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      timezone: 'auto',
      forecast_days: 2,
      hourly: 'precipitation,precipitation_probability,weather_code',
    },
  });
  return data;
}

module.exports = { getOutlook };
