// DOM Elements
const zipCodeInput = document.getElementById('zipCode');
const schoolSelect = document.getElementById('schoolSelect');
const checkButton = document.getElementById('checkButton');
const resultDiv = document.getElementById('result');
const predictionText = document.getElementById('prediction');
const detailsText = document.getElementById('details');
const loader = document.getElementById('loader');

// dont use my api key I WILL FIND U... NOT JOKING
const openWeatherMapApiKey = 'db245b99fad85fee3ec7ed0a5b846521';
const openWeatherMapUrl = `https://api.openweathermap.org/data/2.5/weather?q=Novi,MI,US&units=imperial&appid=${openWeatherMapApiKey}`;

// Function to calculate wind chill (Fahrenheit)
function getWindChill(temperature, windSpeed) {
  if (temperature > 50 || windSpeed <= 3) {
    return null; // Wind chill does not apply
  }
  return (
    35.74 +
    0.6215 * temperature -
    35.75 * Math.pow(windSpeed, 0.16) +
    0.4275 * temperature * Math.pow(windSpeed, 0.16)
  );
}

// Function to calculate wind chill probability
function getWindChillProbability(windChill) {
  if (windChill === null) return 0; // Wind chill does not apply
  if (windChill > 0) return 0; // No risk
  if (windChill > -15) return 10; // 0-10% chance
  if (windChill > -20) return 30; // 10-50% chance
  if (windChill > -25) return 70; // 50-90% chance
  return 90; // 90-100% chance
}

// Function to check if ice will form
function willIceForm(temp, dewPoint, humidity, recentPrecipitation) {
  if (temp > 32) return "No ice formation - temperature too high.";

  let frostRisk = temp <= 32 && dewPoint >= temp - 2; // Frost if temp is near dew point
  let highHumidity = humidity > 70;
  let freezingRainRisk = recentPrecipitation && temp <= 32;

  if (freezingRainRisk) return "High risk of ice - freezing rain or snow present!";
  if (frostRisk && highHumidity) return "Possible ice formation due to frost!";
  if (frostRisk) return "Light frost may form.";

  return "Low risk of ice formation.";
}

// Function to calculate ice formation probability
function getIceFormationProbability(iceRisk) {
  if (iceRisk.includes("High risk")) return 70; // 70-100% chance
  if (iceRisk.includes("Possible ice")) return 30; // 30-70% chance
  if (iceRisk.includes("Light frost")) return 10; // 10-30% chance
  return 0; // No ice
}

// Function to calculate school cancellation probability
function calculateCancellationProbability(factors) {
  const probabilities = [
    factors.temperatureProbability,
    factors.windChillProbability,
    factors.iceFormationProbability,
    factors.roadConditionsProbability,
    factors.powerOutagesProbability,
    factors.emergencyAlertsProbability
  ];

  // Calculate the mean of all probabilities
  const meanProbability = probabilities.reduce((sum, prob) => sum + prob, 0) / probabilities.length;
  return Math.min(meanProbability, 100); // Cap at 100%
}

// Function to display results one by one
function displayResults(results) {
  let index = 0;
  const interval = setInterval(() => {
    if (index < results.length) {
      detailsText.innerHTML += `<p>${results[index]}</p>`;
      index++;
    } else {
      clearInterval(interval);
    }
  }, 1000); // Display each result with a 1-second delay
}

// Event Listener for Button Click
checkButton.addEventListener('click', async () => {
  const zipCode = zipCodeInput.value.trim();
  const school = schoolSelect.value;

  // Check if the zip code is 48375
  if (zipCode !== '48375') {
    alert('This is only available in Novi for the zip code 48375.');
    return;
  }

  // Check if a school is selected
  if (!school) {
    alert('Please select a school.');
    return;
  }

  // Show loader and clear previous results
  loader.classList.remove('hidden');
  resultDiv.classList.remove('visible');
  predictionText.textContent = '';
  detailsText.innerHTML = '';

  // Fetch real-time weather data from OpenWeatherMap API
  fetch(openWeatherMapUrl)
    .then((response) => response.json())
    .then((data) => {
      // Extract weather data
      const temperature = data.main.temp; // Temperature in °F
      const windSpeed = data.wind.speed; // Wind speed in mph
      const humidity = data.main.humidity; // Humidity in %
      const dewPoint = temperature - ((100 - humidity) / 5); // Approximate dew point
      const recentPrecipitation = data.weather.some((condition) =>
        ['rain', 'snow', 'sleet'].includes(condition.main.toLowerCase())
      );

      // Calculate wind chill
      const windChill = getWindChill(temperature, windSpeed);
      const windChillProbability = getWindChillProbability(windChill);

      // Check ice formation
      const iceRisk = willIceForm(temperature, dewPoint, humidity, recentPrecipitation);
      const iceFormationProbability = getIceFormationProbability(iceRisk);

      // Simulate other factors (replace with real data if available)
      const factors = {
        temperatureProbability: temperature <= 0 ? 10 : 0, // Temperature factor
        windChillProbability,
        iceFormationProbability,
        roadConditionsProbability: recentPrecipitation ? 30 : 0, // Road conditions factor
        powerOutagesProbability: false ? 50 : 0, // Power outages factor
        emergencyAlertsProbability: false ? 40 : 0 // Emergency alerts factor
      };

      // Calculate cancellation probability
      const probability = calculateCancellationProbability(factors);

      // Hide loader and show result
      loader.classList.add('hidden');
      resultDiv.classList.add('visible');

      // Display the final probability
      predictionText.textContent = `Chance of School Canceling: ${probability.toFixed(2)}%`;

      // Prepare results to display one by one
      const results = [
        `- Temperature: ${temperature}°F`,
        `- Wind Chill: ${windChill !== null ? windChill.toFixed(2) + '°F' : 'N/A'}`,
        `- Ice Formation: ${iceRisk}`,
        `- Road Conditions: ${recentPrecipitation ? 'Icy' : 'Clear'}`,
        `- Power Outages: ${false ? 'Yes' : 'No'}`,
        `- Emergency Alerts: ${false ? 'Yes' : 'No'}`
      ];

      // Display results one by one
      displayResults(results);
    })
    .catch((error) => {
      alert(`Error fetching weather data: ${error.message}`);
      loader.classList.add('hidden');
    });
});
