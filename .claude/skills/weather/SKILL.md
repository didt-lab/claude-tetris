---
name: weather
description: Get current local weather for a city (temperature, conditions, wind). Use when user asks "what's the weather in <city>", "clima en <ciudad>", or similar.
---

# Weather lookup

Get current weather for a given city using Open-Meteo (free, no API key needed).

## Steps

1. Geocode the city name to lat/lon:
   `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=es&format=json`
   Use WebFetch. Take `results[0].latitude`, `results[0].longitude`, `results[0].name`, `results[0].country`.

2. Fetch current weather with those coordinates:
   `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code`
   Use WebFetch.

3. Map `weather_code` (WMO code) to a short description (0=clear, 1-3=partly cloudy, 45/48=fog, 51-67=rain, 71-77=snow, 80-82=showers, 95-99=thunderstorm).

4. Report to the user: city, country, temperature (°C), feels-like, humidity, wind speed, condition.

If geocoding returns no results, tell the user the city wasn't found and ask them to clarify (region/country).
