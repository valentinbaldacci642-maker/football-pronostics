addEventListener('checkEarthquakes', async (resolve, reject, args) => {
  try {
    // Read settings from KV store
    const notifM4Raw    = await CapacitorKV.get('notifM4');
    const notifMinMagRaw = await CapacitorKV.get('notifMinMag');
    const radiusRaw     = await CapacitorKV.get('radius');
    const cityLatRaw    = await CapacitorKV.get('cityLat');
    const cityLonRaw    = await CapacitorKV.get('cityLon');
    const lastCheckRaw  = await CapacitorKV.get('lastCheckTime');

    const notifM4    = notifM4Raw.value    === 'true';
    const notifMinMag = parseFloat(notifMinMagRaw.value) || 5;
    const radius     = parseFloat(radiusRaw.value)    || 0;
    const cityLat    = parseFloat(cityLatRaw.value)   || null;
    const cityLon    = parseFloat(cityLonRaw.value)   || null;
    const lastCheck  = parseFloat(lastCheckRaw.value) || 0;

    const zoneActive = radius > 0 && cityLat !== null;
    if (!notifM4 && !zoneActive) { resolve(); return; }

    const now = Date.now();
    // Fetch last 30 minutes of earthquakes from USGS
    const startTime = new Date(now - 30 * 60 * 1000).toISOString();
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&minmagnitude=0&orderby=time`;

    const response = await fetch(url);
    const data = await response.json();
    const features = data.features || [];

    let notifId = parseInt((await CapacitorKV.get('notifIdCounter')).value || '1000');

    for (const f of features) {
      const props = f.properties;
      const coords = f.geometry.coordinates;
      const eqTime = props.time;
      if (lastCheck > 0 && eqTime <= lastCheck) continue;

      const mag   = props.mag;
      const place = props.place || '';
      const depth = coords[2];
      const lat   = coords[1];
      const lon   = coords[0];
      const tsunami = props.tsunami;

      const tsunamiSuffix = tsunami === 1 ? ' ⚠️ TSUNAMI' : '';
      const iconColor = mag >= 7 ? '#ef4444' : mag >= 4 ? '#f97316' : '#22c55e';

      if (notifM4 && mag >= notifMinMag) {
        notifId++;
        await LocalNotifications.schedule({
          notifications: [{
            title: `SÉISME DÉTECTÉ ! M${mag.toFixed(1)}${tsunamiSuffix}`,
            body: `${place} — Prof. ${depth != null ? Math.round(depth) : '?'} km`,
            id: notifId,
            schedule: { at: new Date(Date.now() + 500) },
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor
          }]
        });
      }

      if (zoneActive) {
        const dist = haversine(cityLat, cityLon, lat, lon);
        if (dist <= radius) {
          notifId++;
          await LocalNotifications.schedule({
            notifications: [{
              title: `SÉISME À PROXIMITÉ M${mag.toFixed(1)}${tsunamiSuffix}`,
              body: `À ${Math.round(dist)} km — ${place}`,
              id: notifId,
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor
            }]
          });
        }
      }
    }

    await CapacitorKV.set('lastCheckTime', String(now));
    await CapacitorKV.set('notifIdCounter', String(notifId));
    resolve();
  } catch (e) {
    reject(e);
  }
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2)
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
