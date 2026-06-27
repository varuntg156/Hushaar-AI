# Hushaar AI 🌡️🤖

An AI-powered smart climate control dashboard that predicts temperature changes and automatically adjusts indoor cooling for improved comfort and energy efficiency.

## 🚀 Live Demo

See the smart dashboard in action here:
🔗 **[Launch Hushaar AI Live Dashboard](https://hushaar-ai-six.vercel.app/)**

## ✨ Features

- **Real-time indoor temperature monitoring**
- **Live outdoor weather integration**
- **Humidity tracking**
- **24-hour temperature forecasting**
- **AI-based heatwave prediction engine**
- **Automatic pre-cooling system**
- **MQTT-based device communication**
- **ESP32 IoT integration** (Conceptual architecture)
- **Smart target temperature control**
- **Dashboard for monitoring and automation**

## 📊 Dashboard Overview

- Indoor Temperature Monitoring
- Outdoor Weather Data
- Humidity Analysis
- System Status Tracking
- Prediction Engine Logs
- MQTT Live Feed
- Device Control Panel
- AI Cooling Recommendations

## 🛠️ Technologies Used

- **Frontend Framework:** Vite + React / TypeScript
- **UI & Styling:** Tailwind CSS + shadcn/ui
- **IoT Protocol:** MQTT Protocol (Climai standard architecture)
- **APIs:** OpenWeatherMap API
- **Design Tools:** Figma

## ⚙️ How It Works

1. Weather data is fetched from the OpenWeatherMap API.
2. The prediction engine analyzes outdoor temperature trends.
3. Heatwave conditions are detected in advance.
4. Pre-cooling commands are queued for the ESP32 device via MQTT.
5. The air conditioning system simulates automatic adjustment.
6. Indoor conditions are continuously monitored and optimized.

## 📡 MQTT Topics

| Topic | Purpose |
|------|----------|
| climai/forecast | Weather forecast data |
| climai/predict | Heatwave prediction |
| climai/cmd/ac | AC control commands |
| climai/esp32/ack | Device acknowledgment |
| climai/indoor | Indoor sensor data |
| climai/outdoor | Outdoor weather data |

## 🎯 Objectives

- Improve indoor comfort.
- Reduce energy consumption.
- Predict temperature changes proactively.
- Enable intelligent climate automation.

## 👥 The Team

- **Varun T G** ([@varuntg156](https://github.com/varuntg156)) - **Team Lead & Frontend Developer** 🚀
  - Led the project architecture, milestone tracking, and sprint timeline.
  - Co-designed the UI/UX mockups and developed the live interactive dashboard using Vite and TypeScript.
- **Pranay** ([@dsvgpranay-alt](https://github.com/dsvgpranay-alt)) - **UI/UX Designer & Core Developer** 🎨
  - Collaborated on product design, user workflow mapping, and dashboard interface layout within Figma.
  - Assisted in structuring frontend components and styling.
- **Theajashri** - **Product Strategist** 💡
  - Formulated the original core concept, key automation features, and targeted use cases for the climate control platform.

## 🔮 Future Enhancements

- Hardware prototyping with a real physical ESP32 module.
- Mobile application support.
- Voice assistant integration.
- Full machine learning-based historical temperature pattern analysis.
- Multi-room climate management.
