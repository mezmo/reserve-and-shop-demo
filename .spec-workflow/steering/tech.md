# Technical Steering

## Architecture Overview

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Backend API    │    │  Log Generators │
│   (React/TS)    │◄──►│   (Node.js)      │◄──►│   (Configurable)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Dashboard UI   │    │ Configuration    │    │   Log Agents    │
│  (Real-time)    │    │     Store        │    │ (Mezmo/DD/OTEL) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: React 18+ with TypeScript, Tailwind CSS
- **Backend**: Node.js with Express, WebSocket support
- **Database**: SQLite for local configuration storage
- **Log Generation**: Custom log generators with pluggable patterns
- **Agent Integration**: Native agent binaries and configuration
- **Real-time Updates**: WebSocket connections for live metrics
- **Packaging**: Electron for cross-platform desktop distribution

### Integration Patterns
- **Agent Communication**: Direct binary execution and file-based configuration
- **Log Streaming**: File watchers and real-time log parsing
- **Configuration Management**: JSON-based schema with validation
- **Error Handling**: Graceful degradation with user-friendly error messages

### Data Flow Design
1. **Configuration Input**: User selects log scenario via UI
2. **Agent Setup**: Backend configures selected collection agents
3. **Log Generation**: Spawned processes generate logs according to patterns
4. **Collection**: Agents collect logs and forward to configured endpoints
5. **Monitoring**: Real-time metrics displayed in dashboard
6. **Export**: Save configurations and sample logs for reuse

## Development Standards

### Coding Conventions
- **Language**: TypeScript for all new code (strict mode enabled)
- **Style**: Prettier with ESLint configuration
- **Naming**: camelCase for variables/functions, PascalCase for components
- **File Organization**: Feature-based directory structure
- **Documentation**: JSDoc for public APIs, inline comments for complex logic

### Testing Requirements
- **Unit Tests**: Jest for backend logic, React Testing Library for UI
- **Integration Tests**: End-to-end agent testing with real log collection
- **Coverage Target**: Minimum 80% code coverage
- **Test Data**: Isolated test environments with mock agents
- **Performance Testing**: Load testing for high-volume log scenarios

### Security Guidelines
- **Input Validation**: Strict validation of all user configuration inputs
- **File System Access**: Sandboxed operations with explicit permissions
- **Agent Execution**: Controlled subprocess execution with timeout limits
- **Configuration Storage**: Encrypted sensitive configuration data
- **Network Access**: Restricted outbound connections to known endpoints

### Performance Standards
- **Startup Time**: Application ready within 10 seconds
- **Memory Usage**: Maximum 512MB RAM under normal operation
- **CPU Usage**: Less than 20% CPU during log generation
- **Disk I/O**: Efficient log file management with automatic cleanup
- **Network Efficiency**: Minimal bandwidth usage for agent communication

## Technology Choices

### Programming Languages
- **Frontend**: TypeScript 5.0+ (strict configuration)
- **Backend**: Node.js 18+ (LTS)
- **Scripts**: Shell scripts for agent installation/management
- **Configuration**: JSON Schema for validation

### Frameworks and Libraries
- **UI Framework**: React 18 with hooks-based architecture
- **State Management**: Zustand for global state
- **UI Components**: Custom components with Tailwind CSS
- **API Client**: Axios for HTTP requests
- **WebSocket**: Socket.io for real-time communication
- **File Operations**: Node.js fs/promises with graceful error handling

### Development Tools
- **Build System**: Vite for fast development builds
- **Package Manager**: npm with lockfile version control
- **Code Quality**: ESLint + Prettier + Husky pre-commit hooks
- **Testing**: Jest + React Testing Library + Playwright for E2E
- **Type Checking**: TypeScript compiler with strict configuration

### Deployment Infrastructure
- **Packaging**: Electron Builder for cross-platform distribution
- **Distribution**: GitHub Releases with automated builds
- **Updates**: Electron auto-updater with staged rollouts
- **Logging**: Structured logging with configurable levels
- **Monitoring**: Built-in health checks and diagnostic tools

## Patterns & Best Practices

### Recommended Code Patterns
- **Component Structure**: Functional components with custom hooks
- **State Management**: Reactive patterns with automatic UI updates
- **Error Boundaries**: React error boundaries for UI resilience
- **Configuration**: Builder pattern for complex agent configurations
- **Event Handling**: Observer pattern for real-time log monitoring

### Error Handling Approaches
- **Graceful Degradation**: Continue operation when non-critical features fail
- **User-Friendly Messages**: Translate technical errors to actionable guidance
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Fallback Options**: Alternative approaches when primary methods fail
- **Error Reporting**: Optional anonymous error reporting for improvement

### Logging and Monitoring
- **Structured Logging**: JSON format with consistent field naming
- **Log Levels**: DEBUG, INFO, WARN, ERROR with configurable output
- **Performance Metrics**: Built-in profiling for critical operations
- **Health Checks**: Periodic validation of agent connectivity
- **Diagnostic Mode**: Enhanced logging for troubleshooting scenarios

### Documentation Standards
- **API Documentation**: OpenAPI specification for all endpoints
- **Component Documentation**: Storybook for UI component catalog
- **User Documentation**: Integrated help system with contextual guidance
- **Developer Documentation**: Architecture decision records (ADRs)
- **Configuration Reference**: Complete schema documentation with examples

## Agent Integration Architecture

### Mezmo Agent Integration
- **Installation**: Automated download and configuration
- **Configuration**: Dynamic config file generation
- **Monitoring**: Agent health checking and restart capabilities
- **Log Formats**: Support for structured and unstructured logs

### DataDog Agent Integration
- **Compatibility**: DD Agent 7.x with log collection enabled
- **Configuration**: YAML-based configuration management
- **Tagging**: Automatic tag generation for demo scenarios
- **Metrics**: Integration with DD metrics collection

### OTEL Collector Integration
- **Configuration**: YAML pipeline configuration
- **Receivers**: File, syslog, and HTTP receivers
- **Processors**: Filtering, transformation, and enrichment
- **Exporters**: Configurable output destinations

## Quality Assurance

### Automated Testing Strategy
- **Unit Testing**: Individual component and function testing
- **Integration Testing**: Agent interaction and configuration testing
- **UI Testing**: User workflow and accessibility testing
- **Performance Testing**: Load testing with realistic log volumes
- **Compatibility Testing**: Multi-platform agent compatibility

### Code Review Process
- **Pull Request Requirements**: Tests, documentation, and approval
- **Review Criteria**: Code quality, security, and performance impact
- **Automated Checks**: Linting, testing, and build verification
- **Documentation Updates**: Ensure docs reflect code changes