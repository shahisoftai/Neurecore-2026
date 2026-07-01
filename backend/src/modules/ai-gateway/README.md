# AI Gateway Module

## Overview

The AI Gateway module provides unified interfaces for AI agent communication and observability:

- **OpenClaw Gateway Service**: Handles communication with OpenClaw-enabled AI agents
- **LangSmith Tracing Service**: Provides observability for AI agent services

## Environment Variables

### OpenClaw Configuration

```env
OPENCLAW_ENDPOINT=https://api.openclaw.ai/v1
OPENCLAW_API_KEY=your-openclaw-api-key
OPENCLAW_TIMEOUT=30000
OPENCLAW_RETRY_ATTEMPTS=3
OPENCLAW_ENABLE_TRACING=true
```

### LangSmith Configuration

```env
LANGSMITH_API_KEY=your-langsmith-api-key
LANGSMITH_PROJECT=neurecore
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_TRACING_ENABLED=false
```

## Usage

### OpenClaw Gateway

```typescript
import { OpenClawGatewayService } from './ai-gateway';

@Injectable()
export class MyService {
  constructor(private readonly openclaw: OpenClawGatewayService) {}

  async sendToAgent(agentId: string) {
    const response = await this.openclaw.sendMessage(
      agentId,
      'analyze',
      { input: 'data' },
      { tenantId: '123' },
    );

    if (response.success) {
      console.log('Response:', response.data);
    }
  }
}
```

### LangSmith Tracing

```typescript
import { LangSmithTracingService } from './ai-gateway';

@Injectable()
export class MyService {
  constructor(private readonly tracing: LangSmithTracingService) {}

  async processTask() {
    const result = await this.tracing.trace(
      'processTask',
      async (span) => {
        // Your logic here
        return { processed: true };
      },
      { metadata: { taskType: 'analysis' } },
    );

    return result;
  }
}
```

## Architecture

```
ai-gateway/
├── ai-gateway.module.ts       # Module definition + config
├── openclaw-gateway.service.ts # OpenClaw protocol handler
├── langsmith-tracing.service.ts # LangSmith observability
└── index.ts                   # Exports
```
