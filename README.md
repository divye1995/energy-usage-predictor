# Energy Forecast & Comparator

A comprehensive React-based web application for energy cost projection and comparison with AI-powered insights. Calculate, visualize, and compare electricity costs across different tariff scenarios with seasonal adjustments and intelligent forecasting.

![Energy Calculator](https://via.placeholder.com/800x400?text=Energy+Forecast+%26+Comparator)

## 🚀 Features

### Core Functionality
- **Smart Tariff Calculation**: Input current rates and automatically calculate future tariff bands with seasonal adjustments
- **Usage Projection**: Project monthly energy consumption based on historical patterns
- **Cost Visualization**: Interactive charts showing usage and cost projections over time
- **Session Management**: Save and load different scenarios for comparison
- **Fixed vs Variable Rates**: Toggle between fixed rates and seasonal tariff bands

### Advanced Features
- **AI-Powered Insights**: Get personalized energy-saving tips using Google Gemini AI
- **Scenario Comparison**: Compare multiple saved sessions with detailed analysis
- **Seasonal Intelligence**: Automatic rate adjustments for winter (10% higher) and summer (5% lower) months
- **Peak/Off-Peak Analysis**: Configurable peak usage percentage for accurate cost modeling
- **Export & Import**: Local storage for session persistence

### AI Integration
- **Usage Tips**: AI-generated recommendations for cost reduction
- **Comparison Analysis**: Intelligent summary of scenario differences
- **Markdown Formatting**: Rich text AI responses with proper formatting
- **Privacy-First**: Your API key stays in your browser

## 🛠️ Technology Stack

- **Frontend**: React 18, JavaScript ES6+
- **Styling**: Tailwind CSS with Typography plugin
- **Charts**: Chart.js for interactive visualizations
- **AI**: Google Gemini API integration
- **Build Tool**: Vite
- **Package Manager**: npm

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (version 16.0 or higher)
- npm (version 7.0 or higher)
- A modern web browser

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/energy-calc-app.git
cd energy-calc-app/my-energy-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the application in your browser.

### 4. Build for Production
```bash
npm run build
```

## 🔑 Setting Up AI Features

To use the AI-powered insights:

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a free account and generate an API key
   - Copy your API key

2. **Configure in the App**:
   - Click "Get Usage Tips ✨" or "Summarize Comparison ✨"
   - Enter your API key in the modal that appears
   - Your key is stored locally and never sent to our servers

## 📚 Usage Guide

### Basic Setup
1. **Set Current Month**: Select the current month for seasonal calculations
2. **Choose Rate Type**: Toggle between fixed rates or variable tariff bands
3. **Input Usage Pattern**: Enter monthly usage projection (comma-separated kWh values)
4. **Configure Peak Usage**: Set the percentage of usage during peak hours

### Tariff Configuration
- **Fixed Rates**: Enter consistent peak, off-peak, and standing charge rates
- **Variable Bands**: Input current tariff rates, and the app automatically calculates future bands with seasonal adjustments

### Session Management
- **Save Sessions**: Name and save your current configuration
- **Load Sessions**: Select from saved sessions to quickly switch scenarios
- **Compare Sessions**: Analyze differences between multiple scenarios

### AI Insights
- **Usage Tips**: Get personalized recommendations for reducing energy costs
- **Comparison Analysis**: Understand which scenario is more cost-effective and why

## 🎯 Use Cases

- **Homeowners**: Compare different energy tariffs and plans
- **Energy Consultants**: Model scenarios for clients
- **Utility Companies**: Demonstrate tariff options to customers
- **Researchers**: Analyze energy consumption patterns
- **Students**: Learn about energy economics and forecasting

## 🏗️ Project Structure

```
my-energy-app/
├── public/
│   └── vite.svg
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── index.css        # Global styles
│   ├── main.jsx         # Application entry point
│   └── assets/
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## 🎨 Customization

### Styling
The application uses Tailwind CSS for styling. Customize the appearance by:
- Modifying `tailwind.config.js`
- Updating color schemes in `App.jsx`
- Adding custom CSS classes

### Calculations
Energy calculations can be customized by modifying:
- Seasonal multipliers (currently 1.1 for winter, 0.95 for summer)
- Base rate increases (currently 0.5p per quarter)
- Days in month calculations

### AI Prompts
Customize AI responses by modifying the prompts in:
- `getUsageTips()` function for usage recommendations
- `getComparisonSummary()` function for scenario analysis

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the Repository**
   ```bash
   git fork https://github.com/your-username/energy-calc-app.git
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests if applicable

4. **Commit Changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```

5. **Push to Branch**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**
   - Describe your changes
   - Include screenshots if UI changes
   - Reference any related issues

### Development Guidelines
- Follow React best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Maintain responsive design principles
- Test on different browsers and screen sizes

## 🐛 Bug Reports

Found a bug? Please create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots if applicable

## 💡 Feature Requests

Have an idea for improvement? Open an issue with:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Mockups or wireframes if UI-related

## 📄 Available Scripts

In the project directory, you can run:

### `npm run dev`
Runs the app in development mode. Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`
Builds the app for production to the `dist` folder.

### `npm run preview`
Locally preview the production build.

### `npm run lint`
Run ESLint to check for code quality issues.

## 🔧 Configuration

### Vite Configuration
The project uses Vite for fast development and building. Key plugins:
- `@vitejs/plugin-react` - React support with Fast Refresh

### Tailwind Configuration
Customized with:
- Typography plugin for prose styling
- Custom color schemes for AI responses

### ESLint Configuration
For code quality and consistency. To expand ESLint configuration for production:
- Consider adding TypeScript support
- Enable type-aware lint rules
- Add additional ESLint plugins as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Energy Calc App

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgments

- **Chart.js** - For beautiful and interactive charts
- **Tailwind CSS** - For rapid UI development
- **Google Gemini** - For AI-powered insights
- **React** - For the robust component framework
- **Vite** - For fast development and building
- **React Markdown** - For rendering AI responses

## 📞 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🔗 Useful Links

- **React Documentation**: [https://react.dev](https://react.dev)
- **Vite Documentation**: [https://vitejs.dev](https://vitejs.dev)
- **Tailwind CSS**: [https://tailwindcss.com](https://tailwindcss.com)
- **Chart.js**: [https://www.chartjs.org](https://www.chartjs.org)
- **Google Gemini API**: [https://ai.google.dev/docs](https://ai.google.dev/docs)

---

<p align="center">
  Made with ❤️ for the energy-conscious community
</p>

<p align="center">
  <a href="#energy-forecast--comparator">Back to Top</a>
</p>
