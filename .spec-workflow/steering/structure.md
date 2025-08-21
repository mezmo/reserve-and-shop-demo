# Structure Steering

## Project Organization

### Directory Structure
```
/app
├── src/                          # Source code
│   ├── components/               # React components
│   │   ├── common/              # Reusable UI components
│   │   ├── dashboard/           # Dashboard-specific components
│   │   ├── agents/              # Agent management components
│   │   └── logs/                # Log viewing components
│   ├── pages/                   # Application pages
│   ├── hooks/                   # Custom React hooks
│   ├── services/                # Business logic and API calls
│   │   ├── agents/              # Agent integration services
│   │   ├── logs/                # Log generation services
│   │   └── config/              # Configuration management
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   └── styles/                  # Global styles and themes
├── server/                      # Backend Node.js application
│   ├── routes/                  # API route definitions
│   ├── services/                # Backend business logic
│   ├── middleware/              # Express middleware
│   ├── models/                  # Data models and schemas
│   └── utils/                   # Server utility functions
├── agents/                      # Agent binaries and configurations
│   ├── mezmo/                   # Mezmo Agent files
│   ├── datadog/                 # DataDog Agent files
│   └── otel/                    # OpenTelemetry Collector files
├── configs/                     # Configuration templates
│   ├── scenarios/               # Pre-built log scenarios
│   └── templates/               # Agent configuration templates
├── logs/                        # Generated log files (gitignored)
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # End-to-end tests
├── docs/                        # Documentation
│   ├── user-guide/              # User documentation
│   ├── developer/               # Developer documentation
│   └── api/                     # API documentation
├── scripts/                     # Build and deployment scripts
└── .spec-workflow/              # Spec-driven development files
    ├── steering/                # Steering documents
    └── specs/                   # Feature specifications
```

### File Naming Conventions
- **Components**: PascalCase (e.g., `AgentManager.tsx`, `LogViewer.tsx`)
- **Pages**: PascalCase with Page suffix (e.g., `DashboardPage.tsx`)
- **Services**: camelCase (e.g., `agentService.ts`, `logGenerator.ts`)
- **Utilities**: camelCase (e.g., `fileUtils.ts`, `configValidator.ts`)
- **Types**: PascalCase with Type suffix (e.g., `AgentConfigType.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)
- **Tests**: Same as source file with `.test.ts` or `.spec.ts` suffix

### Module Organization
- **Feature-based grouping**: Related components, services, and types together
- **Barrel exports**: Index files for clean imports (`export * from './module'`)
- **Dependency direction**: UI components depend on services, not vice versa
- **Shared utilities**: Common functionality in dedicated utils directories
- **Type definitions**: Centralized type definitions with clear naming

### Configuration Management
- **Environment Variables**: `.env` files for environment-specific settings
- **JSON Schema**: Validate all configuration files against schemas
- **Default Configurations**: Sensible defaults with override capabilities
- **Secret Management**: Encrypted storage for sensitive configuration data
- **Version Control**: Configuration templates in git, instances gitignored

## Development Workflow

### Git Branching Strategy
- **Main Branch**: `main` - stable, deployable code
- **Feature Branches**: `feature/feature-name` - new functionality
- **Bug Fix Branches**: `fix/bug-description` - bug fixes
- **Release Branches**: `release/version` - release preparation
- **Hotfix Branches**: `hotfix/critical-fix` - urgent production fixes

### Branch Naming Conventions
- **Features**: `feature/agent-configuration-ui`
- **Bug Fixes**: `fix/log-generation-memory-leak`
- **Specifications**: `spec/user-authentication-system`
- **Refactoring**: `refactor/component-architecture`
- **Documentation**: `docs/user-guide-updates`

### Code Review Process
1. **Pull Request Creation**: Include description, testing notes, and screenshots
2. **Automated Checks**: CI/CD pipeline runs tests and code quality checks
3. **Peer Review**: At least one team member reviews for code quality
4. **Testing Verification**: Manual testing of new functionality
5. **Approval and Merge**: Squash merge to main branch with clean history

### Testing Workflow
- **Test-Driven Development**: Write tests before implementing features
- **Continuous Integration**: Automated testing on all pull requests
- **Local Testing**: `npm run test` before committing changes
- **Integration Testing**: Full agent testing before releases
- **Performance Testing**: Regular benchmarking of log generation performance

### Deployment Process
- **Local Development**: `npm run dev` for hot reloading
- **Build Process**: `npm run build` for production builds
- **Packaging**: Electron Builder for cross-platform distribution
- **Release Management**: GitHub Actions for automated releases
- **Update Distribution**: Staged rollout with rollback capabilities

## Documentation Structure

### Where to Find What
- **User Documentation**: `/docs/user-guide/` - End-user instructions
- **API Documentation**: `/docs/api/` - Backend API reference
- **Developer Docs**: `/docs/developer/` - Architecture and setup guides
- **Component Docs**: Storybook for UI component documentation
- **Configuration Docs**: `/configs/README.md` - Agent setup instructions

### How to Update Documentation
- **User Guides**: Update with new features and workflow changes
- **API Docs**: Auto-generated from OpenAPI specifications
- **Code Documentation**: JSDoc comments for complex functions
- **README Files**: Keep current with setup and usage instructions
- **Changelog**: Document all changes for each release

### Specification Organization
- **Requirements**: Business needs and user stories
- **Design**: Technical architecture and implementation plans
- **Tasks**: Detailed implementation steps and acceptance criteria
- **Status Tracking**: Progress monitoring and completion validation

### Bug Tracking Process
- **Issue Templates**: Structured bug reports with reproduction steps
- **Priority Levels**: Critical, High, Medium, Low based on impact
- **Assignment Workflow**: Clear ownership and responsibility
- **Resolution Tracking**: Status updates and verification steps

## Team Conventions

### Communication Guidelines
- **Daily Standups**: Progress updates and blocker identification
- **Code Reviews**: Constructive feedback and knowledge sharing
- **Documentation**: Clear, concise writing for all documentation
- **Issue Tracking**: Detailed descriptions with context and steps
- **Slack Channels**: Dedicated channels for development and support

### Meeting Structures
- **Planning Sessions**: Feature planning and estimation
- **Retrospectives**: Process improvement and lessons learned
- **Technical Reviews**: Architecture decisions and code quality
- **Demo Sessions**: Feature demonstrations and feedback
- **Bug Triage**: Priority assessment and assignment

### Decision-Making Process
- **RFC Process**: Request for Comments for major changes
- **Architecture Decisions**: Document rationale and alternatives considered
- **Consensus Building**: Team input on significant decisions
- **Decision Records**: Archive of important technical decisions
- **Review Cycles**: Regular evaluation of decisions and outcomes

### Knowledge Sharing
- **Code Documentation**: Comprehensive inline documentation
- **Wiki Maintenance**: Up-to-date knowledge base
- **Pair Programming**: Knowledge transfer and code quality
- **Tech Talks**: Internal presentations on new technologies
- **Best Practices**: Shared coding standards and patterns

## Development Environment Setup

### Prerequisites
- **Node.js**: Version 18+ (LTS recommended)
- **npm**: Latest version with package-lock.json
- **Git**: Version control with configured SSH keys
- **IDE**: VS Code with recommended extensions
- **Agents**: Local installation of supported log collection agents

### Recommended VS Code Extensions
- **TypeScript**: Enhanced TypeScript support
- **Prettier**: Code formatting
- **ESLint**: Code quality and standards
- **Auto Rename Tag**: HTML/JSX tag management
- **GitLens**: Enhanced Git integration
- **REST Client**: API testing within VS Code

### Local Development Workflow
1. **Repository Clone**: `git clone <repo-url>`
2. **Dependency Installation**: `npm install`
3. **Environment Setup**: Copy `.env.example` to `.env`
4. **Database Setup**: Initialize local SQLite database
5. **Agent Installation**: Download and configure agents
6. **Development Server**: `npm run dev` for hot reloading

### Testing Environment
- **Unit Tests**: `npm run test:unit`
- **Integration Tests**: `npm run test:integration`
- **E2E Tests**: `npm run test:e2e`
- **Coverage Report**: `npm run test:coverage`
- **Watch Mode**: `npm run test:watch` for development

## Quality Assurance

### Code Quality Standards
- **TypeScript Strict Mode**: Enabled for all code
- **ESLint Configuration**: Consistent code style enforcement
- **Prettier Formatting**: Automated code formatting
- **Pre-commit Hooks**: Quality checks before commits
- **SonarQube Integration**: Code quality and security analysis

### Performance Monitoring
- **Bundle Size**: Monitor and optimize application size
- **Memory Usage**: Track memory consumption during log generation
- **CPU Performance**: Profile high-usage operations
- **Network Efficiency**: Minimize unnecessary requests
- **Load Testing**: Regular performance benchmarking

### Security Practices
- **Dependency Scanning**: Regular security audits of dependencies
- **Input Validation**: Strict validation of all user inputs
- **Secure Configuration**: Encrypted storage of sensitive data
- **Access Control**: Principle of least privilege for file system access
- **Security Testing**: Regular penetration testing and vulnerability assessment