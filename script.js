// DOM Elements
const zipCodeInput = document.getElementById('zipCode');
const schoolSelect = document.getElementById('schoolSelect');
const checkButton = document.getElementById('checkButton');
const resultDiv = document.getElementById('result');
const predictionText = document.getElementById('prediction');
const detailsText = document.getElementById('details');
const loader = document.getElementById('loader');

// Novi, MI coordinates (fixed - site is Novi-only)
const noviLat = 42.48;
const noviLon = -83.47;

// Open-Meteo API - no key needed!
const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${noviLat}&longitude=${noviLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FDetroit`;

// Wind chill formula (Fahrenheit) - NOAA standard
function getWindChill(temp, windSpeed) {
  if (temp >= 50 || windSpeed <= 3) return null;
  return (
    35.74 +
    0.6215 * temp -
    35.75 * Math.pow(windSpeed, 0.16) +
    0.4275 * temp * Math.pow(windSpeed, 0.16)
  ).toFixed(1);
}

// Estimate ice/frost risk (improved logic)
function getIceRisk(temp, humidity, precip, weatherCode) {
  if (temp > 32) return { text: "No ice - temperature above freezing.", prob: 0 };

  const isFreezingRainOrSleet = [66, 67, 85, 86].includes(weatherCode); // WMO codes for freezing precip
  const highHumidity = humidity >= 85;
  const nearDewPoint = humidity >= 90; // rough frost proxy

  if (isFreezingRainOrSleet && precip > 0) {
    return { text: "High risk - freezing rain/sleet possible!", prob: 85 };
  }
  if (nearDewPoint && temp <= 32 && temp >= 28) {
    return { text: "Frost likely - black ice possible on roads.", prob: 45 };
  }
  if (temp <= 28 && highHumidity) {
    return { text: "Moderate ice/frost risk.", prob: 25 };
  }
  return { text: "Low ice risk.", prob: 5 };
}

// Rough precip/snow impact (higher if precip + cold)
function getPrecipRoadRisk(precip, temp, weatherCode) {
  const isSnow = [71, 73, 75, 77, 85, 86].includes(weatherCode); // snow codes
  if (precip > 0.1 && temp < 32) {
    return isSnow ? 60 : 45; // snow worse than rain
  }
  if (precip > 0.01 && temp < 35) return 20;
  return 0;
}

// Main probability logic - more realistic for MI schools
function calculateCancellationProbability(data) {
  const temp = data.current.temperature_2m;
  const feelsLike = data.current.apparent_temperature; // already includes wind chill effect
  const windSpeed = data.current.wind_speed_10m;
  const humidity = data.current.relative_humidity_2m;
  const precip = data.current.precipitation;
  const weatherCode = data.current.weather_code;

  const windChill = getWindChill(temp, windSpeed);
  const effectiveChill = windChill !== null ? Math.min(feelsLike, windChill) : feelsLike;

  // Core factors (0-100 scale)
  let windChillProb = 0;
  if (effectiveChill <= -25) windChillProb = 95;
  else if (effectiveChill <= -20) windChillProb = 80;
  else if (effectiveChill <= -15) windChillProb = 50;
  else if (effectiveChill <= -10) windChillProb = 20;

  const iceRisk = getIceRisk(temp, humidity, precip, weatherCode);
  const precipRoadRisk = getPrecipRoadRisk(precip, temp, weatherCode);

  // Extreme cold bonus
  const extremeColdProb = temp <= -5 ? 70 : (temp <= 0 ? 30 : 0);

  // Combine - weighted average (wind chill & precip/ice matter most in MI)
  const probs = [
    windChillProb * 0.40,
    iceRisk.prob * 0.25,
    precipRoadRisk * 0.20,
    extremeColdProb * 0.15
  ];

  let total = probs.reduce((a, b) => a + b, 0);
  // Bonus if multiple factors align
  if (windChillProb > 50 && (iceRisk.prob > 30 || precipRoadRisk > 30)) total += 20;

  return Math.min(Math.max(total, 0), 100);
}

// Display results one by one (unchanged style)
function displayResults(results) {
  let index = 0;
  const interval = setInterval(() => {
    if (index < results.length) {
      detailsText.innerHTML += `<p>${results[index]}</p>`;
      index++;
    } else {
      clearInterval(interval);
    }
  }, 1000);
}

// Button click
checkButton.addEventListener('click', async () => {
  const zipCode = zipCodeInput.value.trim();
  const school = schoolSelect.value;

  if (zipCode !== '48375') {
    alert('This is only available in Novi for the zip code 48375.');
    return;
  }

  if (!school) {
    alert('Please select a school.');
    return;
  }

  loader.classList.remove('hidden');
  resultDiv.classList.remove('visible');
  predictionText.textContent = '';
  detailsText.innerHTML = '';

  try {
    const response = await fetch(openMeteoUrl);
    if (!response.ok) throw new Error('Weather service issue');
    const data = await response.json();

    const temp = data.current.temperature_2m.toFixed(1);
    const feelsLike = data.current.apparent_temperature.toFixed(1);
    const windSpeed = data.current.wind_speed_10m.toFixed(1);
    const humidity = data.current.relative_humidity_2m;
    const precip = data.current.precipitation.toFixed(2);
    const weatherCode = data.current.weather_code;

    const windChillVal = getWindChill(parseFloat(temp), parseFloat(windSpeed));
    const iceRiskObj = getIceRisk(parseFloat(temp), humidity, parseFloat(precip), weatherCode);

    const probability = calculateCancellationProbability(data);

    loader.classList.add('hidden');
    resultDiv.classList.add('visible');

    predictionText.textContent = `Chance of School Canceling: ${probability.toFixed(0)}%`;

    const results = [
      `Temperature: ${temp}°F (feels like ${feelsLike}°F)`,
      `Wind Chill: ${windChillVal !== null ? windChillVal + '°F' : 'N/A'}`,
      `Ice Risk: ${iceRiskObj.text}`,
      `Precipitation: ${precip} in (may affect roads)`,
      `Humidity: ${humidity}%`,
      `Wind Speed: ${windSpeed} mph`
    ];

    displayResults(results);

  } catch (error) {
    alert(`Couldn't get weather data: ${error.message}. Try again later!`);
    loader.classList.add('hidden');
  }
});

// === Upgrade banner toggle (added at the end) ===
const toggleBtn = document.getElementById('toggleDetails');
const detailsDiv = document.getElementById('upgradeDetails');

if (toggleBtn && detailsDiv) {
  toggleBtn.addEventListener('click', () => {
    detailsDiv.classList.toggle('hidden');
    toggleBtn.textContent = detailsDiv.classList.contains('hidden') 
      ? 'Learn More ▼' 
      : 'Hide Details ▲';
  });
}
