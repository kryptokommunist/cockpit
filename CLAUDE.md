# Development Workflow

## Using Docker for Development and Testing

**IMPORTANT**: Always use Docker for development and testing. Do NOT attempt to build or run locally with npm/node commands.

### Quick Start

Use docker-compose to start the development environment:

```sh
# Start development server (recommended - starts both webapp and backend)
docker-compose up webapp

# Start in background
docker-compose up -d webapp

# View logs
docker-compose logs -f webapp

# Stop containers
docker-compose down

# Rebuild after dependency changes
docker-compose build webapp
docker-compose up -d webapp
```

### Testing Changes

1. Make changes to source files (they're automatically synced via volumes)
2. Browser will hot-reload automatically
3. For dependency changes: rebuild the container
4. Test in browser at http://localhost:3000

### Available Commands (inside container)

```sh
# Enter the container
docker-compose exec webapp sh

# Inside container you can run:
npm run typecheck          # Type checking
npm run test -- -t "test"  # Run specific test
npm run lint:file -- "file.ts"  # Lint specific file
npm run lint               # Lint all files
```

### Common Tasks

#### Before Committing
```sh
# These should be run inside the Docker container
docker-compose exec webapp npm run lint:claude
docker-compose exec webapp npm run test
```

#### Troubleshooting
```sh
# Clean rebuild
docker-compose down
docker-compose build --no-cache webapp
docker-compose up webapp

# Check logs
docker-compose logs webapp

# Container not starting?
docker ps -a  # Check container status
docker-compose logs webapp  # View error logs
```

## Port Reference

- **3004**: Frontend dev server
- **3005**: Backend API

## Important Notes

- ✅ **DO**: Use Docker for all development and testing
- ✅ **DO**: Rebuild after adding dependencies
- ❌ **DON'T**: Run `npm install` locally
- ❌ **DON'T**: Try to run `npm run dev` locally
- ❌ **DON'T**: Assume node/npm is available in the host environment
