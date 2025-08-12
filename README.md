# Restaurant Performance Demo - Mezmo Log Analysis & Pipeline Platform

## 🎯 Overview

This is a full-stack restaurant management demo application designed to showcase **Mezmo's Log Analysis and Pipeline capabilities**. The app generates realistic restaurant operations data including orders, reservations, and performance metrics, while providing comprehensive logging, metrics collection, and distributed tracing through Mezmo's platform.

### Key Features
- 🍽️ **Restaurant Operations**: Menu management, order processing, and table reservations
- 📊 **Real-time Logging**: Structured logging with multiple formats and levels
- 🔍 **OpenTelemetry Integration**: Distributed tracing and metrics collection
- 📈 **Performance Monitoring**: Real-time performance metrics and analytics
- 🧪 **Testing Tools**: Built-in stress testing and traffic simulation
- 🔧 **Configuration UI**: Easy setup and management of Mezmo integration

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Mezmo account (for log analysis features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd <project-directory>

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

## 🔧 Agent Configuration

The application now features a dedicated **Agents** page (`/agents`) for configuring Mezmo Agent and OpenTelemetry Collector. This replaces the previous Configuration page and provides enhanced multi-environment support.

### Configuration Methods

1. **Web UI Configuration** (Default)
   - Navigate to the Agents page (`/agents`)
   - Select your environment (Development, Integration, or Production)
   - Configure Mezmo Agent and/or OTEL Collector settings
   - Save and start agents directly from the UI

2. **File-Based Configuration** (Pre-configuration)
   - Create an `agents-config.json` file based on the template
   - Use with Docker builds or local development
   - Supports multiple environment configurations
   - Agents auto-start if configuration is valid

### Multi-Environment Support

The Agents page supports three pre-configured environments:
- **Development**: Uses Mezmo's dev endpoints
- **Integration**: Uses Mezmo's integration endpoints  
- **Production**: Uses Mezmo's production endpoints

Each environment can have separate configurations for:
- Mezmo Agent (direct log forwarding)
- OTEL Collector with multi-pipeline support (logs, metrics, traces)

## 🐳 Docker Setup with Agent Configuration

### Building with Agent Configuration

You can pre-configure agents when building the Docker container:

```bash
# Build with agent configuration file
./run-docker.sh --agents-config ./my-agents-config.json

# Or manually with docker build
docker build --build-arg AGENTS_CONFIG_FILE=agents-config.json -t restaurant-app .
```

### Running the Container

```bash
# Run with all required ports
docker run -it -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 restaurant-app

# Run in detached mode
docker run -d -p 8080:8080 -p 3001:3001 -p 4317:4317 -p 4318:4318 --name restaurant-app restaurant-app
```

### Agent Configuration File Template

Create an `agents-config.json` file with the following structure:

```json
{
  "defaultConfig": "dev",
  "configurations": {
    "dev": {
      "displayName": "Development Environment",
      "mezmo": {
        "enabled": true,
        "ingestionKey": "YOUR_DEV_INGESTION_KEY",
        "host": "logs.use.dev.logdna.net",
        "tags": "restaurant-app,dev"
      },
      "otel": {
        "enabled": true,
        "serviceName": "restaurant-app-dev",
        "tags": "restaurant-app,otel,dev",
        "pipelines": {
          "logs": {
            "enabled": true,
            "ingestionKey": "YOUR_DEV_LOGS_KEY",
            "pipelineId": "YOUR_PIPELINE_ID",
            "host": "pipeline.use.dev.mezmo.com"
          },
          "metrics": {
            "enabled": true,
            "ingestionKey": "YOUR_DEV_METRICS_KEY",
            "pipelineId": "",
            "host": "pipeline.use.dev.mezmo.com"
          },
          "traces": {
            "enabled": true,
            "ingestionKey": "YOUR_DEV_TRACES_KEY",
            "pipelineId": "",
            "host": "pipeline.use.dev.mezmo.com"
          }
        }
      }
    },
    "integration": {
      "displayName": "Integration Environment",
      "mezmo": {
        "enabled": false,
        "ingestionKey": "",
        "host": "logs.use.int.logdna.net",
        "tags": "restaurant-app,integration"
      },
      "otel": {
        "enabled": false,
        "serviceName": "restaurant-app-int",
        "tags": "restaurant-app,otel,integration",
        "pipelines": {
          "logs": {
            "enabled": false,
            "ingestionKey": "",
            "pipelineId": "",
            "host": "pipeline.use.int.mezmo.com"
          },
          "metrics": {
            "enabled": false,
            "ingestionKey": "",
            "pipelineId": "",
            "host": "pipeline.use.int.mezmo.com"
          },
          "traces": {
            "enabled": false,
            "ingestionKey": "",
            "pipelineId": "",
            "host": "pipeline.use.int.mezmo.com"
          }
        }
      }
    },
    "production": {
      "displayName": "Production Environment",
      "mezmo": {
        "enabled": false,
        "ingestionKey": "",
        "host": "logs.mezmo.com",
        "tags": "restaurant-app,production"
      },
      "otel": {
        "enabled": false,
        "serviceName": "restaurant-app-prod",
        "tags": "restaurant-app,otel,production",
        "pipelines": {
          "logs": {
            "enabled": false,
            "ingestionKey": "",
            "pipelineId": "",
            "host": "pipeline.mezmo.com"
          },
          "metrics": {
            "enabled": false,
            "ingestionKey": "",
            "pipelineId": "",
            "host": "pipeline.mezmo.com"
          },
          "traces": {
            "enabled": false,
            "ingestionKey": "",
            "pipelineId": "",
            "host": "pipeline.mezmo.com"
          }
        }
      }
    }
  }
}
```

**Configuration Notes:**
- Set `defaultConfig` to the environment you want to use by default
- Enable/disable specific agents and pipelines as needed
- Pipeline IDs are optional but recommended for Mezmo Pipelines routing
- The template file `agents-config.json.template` is provided as a starting point

## 📱 Application Features

### Restaurant Management
- **Home Page**: Restaurant overview and quick actions
- **Menu Management**: Browse and manage restaurant menu items
- **Order System**: Create and track customer orders
- **Reservations**: Table booking and management system
- **Configuration**: Comprehensive settings and integration management

### Logging & Monitoring
- **Structured Logging**: JSON, CLF, and string formats
- **Log Levels**: DEBUG, INFO, WARN, ERROR with configurable verbosity
- **Real-time Metrics**: Performance tracking and business metrics
- **Distributed Tracing**: Full request tracing with OpenTelemetry

## 🔧 Mezmo Configuration Guide

### Setting Up Mezmo Agent

1. **Navigate to Agents Page** (`/agents`)

2. **Mezmo Agent Setup**:
   - Select your environment (Development, Integration, or Production)
   - Toggle "Enable Mezmo Agent" switch
   - Enter your **Ingestion Key** from Mezmo dashboard
   - The **Mezmo Host** is pre-configured based on environment
   - Add **Tags** for log categorization (e.g., `restaurant-app,demo`)
   - Click "Save Configuration"

3. **Agent Status Indicators**:
   - 🟢 **Connected**: Agent running with PID displayed
   - 🔴 **Disconnected**: Agent not running
   - 🔵 **Connecting**: Agent starting up
   - ⚠️ **Error**: Configuration or connection issue

### OpenTelemetry Collector Setup

1. **Enable OTEL Collector**:
   - Toggle "Enable OpenTelemetry Collector"
   - Configure Service Name and Tags
   - Select Debug Level (debug, info, warn, error)

2. **Multi-Pipeline Configuration**:
   
   Each pipeline can be configured independently:
   
   **📄 Logs Pipeline**:
   - Forward structured log files to Mezmo
   - Configure separate ingestion key
   - Optional Pipeline ID for Mezmo Pipelines
   
   **📊 Metrics Pipeline**:
   - Send system and application metrics
   - Independent configuration from logs
   - Custom ingestion endpoint
   
   **🔍 Traces Pipeline**:
   - Receive traces via OTLP protocol
   - Distributed tracing support
   - Full request lifecycle tracking

3. **Pipeline Configuration Steps**:
   - Enable desired pipeline(s)
   - Enter Ingestion Key for each pipeline
   - (Optional) Add Pipeline ID for Mezmo Pipelines
   - Click "Save Multi-Pipeline Config"

### Configuration Tips

- **Environment Selection**: Choose between Development, Integration, and Production environments
- **PID Display**: The UI shows the Process ID when agents are running
- **Auto-sync**: Toggle states automatically sync with actual process status
- **Health Checks**: Use "Test Connection" to verify configuration
- **View Logs**: Check agent logs directly from the UI
- **Pre-configuration**: Use `agents-config.json` file for automated setup

## 🧪 Testing Tools

### API Stress Testing
Test your logging infrastructure with configurable load:
- Set number of orders to generate
- Adjust delay between requests
- Choose request patterns (Sequential/Parallel/Burst)
- Monitor performance under load

### Virtual Traffic Simulator
Simulate realistic user behavior:
- **Quick Buyer**: Direct purchase flow
- **Browser**: Casual browsing pattern
- **Researcher**: Detailed product exploration
- **Mobile User**: Mobile app simulation
- **Return Customer**: Repeat visitor behavior

Features:
- Configurable number of virtual users
- Realistic think times between actions
- Complete user journey tracing
- Performance metrics per user type

### Sample Data Generation
- Generate sample orders with realistic data
- Create test reservations
- Populate menu items
- Useful for testing log parsing and analysis

## 📊 Log Management

### Log Configuration Options

**Log Levels** (in order of verbosity):
- `DEBUG`: Most detailed, includes all information
- `INFO`: Standard operational messages
- `WARN`: Warning messages only
- `ERROR`: Error messages only

**Log Formats**:
- `JSON`: Machine-readable structured logs
- `CLF`: Common Log Format for web servers
- `String`: Human-readable text format

**Log Categories**:
- `Access Logs`: HTTP request/response logs
- `Application Logs`: Business logic and operations
- `Event Logs`: Business events and user actions
- `Performance Logs`: Timing and performance metrics
- `Error Logs`: Application errors and exceptions

### Log Output Locations
- **Application Logs**: `/tmp/codeuser/restaurant-performance.log`
- **Server Logs**: `/tmp/codeuser/server.log`
- **Mezmo Agent Logs**: `/tmp/codeuser/logdna-agent.log`
- **OTEL Collector Logs**: `/tmp/codeuser/otel-collector.log`

## 🏗️ Architecture

### Frontend Stack
- **React** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Router** for navigation

### Backend Stack
- **Express.js** server
- **Winston** for logging
- **OpenTelemetry** for tracing
- **In-memory data store** (demo purposes)

### Observability Stack
- **Mezmo Agent**: Log collection and forwarding
- **OpenTelemetry Collector**: Metrics and traces
- **Multi-pipeline Architecture**: Separate handling for logs, metrics, and traces

## 🔍 Monitoring & Debugging

### Status Monitoring
- Real-time agent status with PID display
- Automatic status polling (10-second intervals)
- Connection health indicators
- Last sync timestamps
- Environment-specific configuration display

### Debug Information
Available in Agents page:
- Collector component status
- Log directory information
- Current configuration display
- Recent collector logs
- File system permissions
- Active environment settings

### Troubleshooting Common Issues

**Agent Won't Start**:
- Verify ingestion key is correct
- Check network connectivity
- Review agent logs for errors
- Ensure proper file permissions

**No Logs Appearing**:
- Confirm agent status shows "Connected"
- Check log level settings
- Verify log file location
- Test with sample data generation

**OTEL Collector Issues**:
- Verify pipeline configuration
- Check collector logs
- Ensure OTLP ports are available
- Test individual pipelines

## 📡 API Endpoints

### Restaurant Operations
- `GET /api/products` - List menu items
- `POST /api/orders` - Create new order
- `GET /api/reservations` - List reservations
- `POST /api/reservations` - Create reservation

### Configuration Management
- `GET /api/mezmo/status` - Mezmo agent status
- `POST /api/mezmo/configure` - Configure Mezmo agent
- `POST /api/mezmo/start` - Start Mezmo agent
- `POST /api/mezmo/stop` - Stop Mezmo agent
- `GET /api/otel/status` - OTEL collector status
- `POST /api/otel/configure` - Configure OTEL collector

### Testing Endpoints
- `POST /api/generate-traffic` - Generate sample traffic
- `GET /api/logs/formats` - Available log formats
- `POST /api/logs/level` - Change log level
- `POST /api/logs/format` - Change log format

## 🚦 Getting Started with Mezmo

1. **Sign up for Mezmo** at [mezmo.com](https://mezmo.com)
2. **Create an Ingestion Key** in your Mezmo dashboard
3. **Configure the Demo App**:
   - Open the Agents page (`/agents`)
   - Select your environment
   - Enter your ingestion key
   - Enable desired features
   - Start generating data
4. **View in Mezmo**:
   - Navigate to your Mezmo dashboard
   - Create views and alerts
   - Analyze patterns and trends
   - Set up pipelines for data transformation

## 🤝 Contributing

This demo application is designed to showcase Mezmo's capabilities. Contributions that enhance the demo experience or add new observable patterns are welcome!

### Development Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run with agent configuration
cp agents-config.json.template agents-config.json
# Edit agents-config.json with your settings
npm run dev

# Run backend only
npm run server

# Run frontend only
npm run client

# Build for production
npm run build

# Build Docker with agent configuration
./run-docker.sh --agents-config ./agents-config.json
```

## 📚 Additional Resources

- [Mezmo Documentation](https://docs.mezmo.com)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Project Tracing README](./src/lib/tracing/README.md)

## 📝 License

This is a demo application for Mezmo's log analysis and pipeline platform.

---

**Need Help?** Check the Agents page's debug section for detailed system information, or view the various log files for troubleshooting.