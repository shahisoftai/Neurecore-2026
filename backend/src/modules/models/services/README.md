# LLM Client Services

## Overview

This directory contains OpenAI-compatible LLM client implementations for multiple providers:

| Provider    | Service                 | Best For               |
| ----------- | ----------------------- | ---------------------- |
| MiniMax     | `MiniMaxClient`         | Fast, cost-effective   |
| DeepSeek    | `DeepSeekClientService` | Deep reasoning tasks   |
| Xiaomi MiMo | `MiMoClientService`     | Balanced agentic tasks |
| OpenAI      | Built-in (via fetch)    | Fallback/legacy        |

## Environment Variables

### MiniMax

```env
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_MODEL=mini-mini-Text-01
```

### DeepSeek

```env
DEEPSEEK_API_KEY=your-deepseek-api-key
```

### Xiaomi MiMo

```env
MIMO_API_KEY=your-mimo-api-key
MIMO_BASE_URL=https://api.mimo.ai/v1
MIMO_MODEL=MiMo-72B-Instruct
```

## Usage

### Direct Client Usage

```typescript
import { MiniMaxClient } from './services/minimax-client.service';
import { DeepSeekClientService } from './services/deepseek-client.service';
import { MiMoClientService } from './services/mimo-client.service';

@Injectable()
export class MyService {
  constructor(
    private readonly minimax: MiniMaxClient,
    private readonly deepseek: DeepSeekClientService,
    private readonly mimo: MiMoClientService,
  ) {}

  async analyze() {
    // Fast inference
    const fast = await this.minimax.invoke('Quick question?');

    // Deep reasoning
    const deep = await this.deepseek.invoke('Complex reasoning problem');

    // Structured output
    const structured = await this.mimo.invokeStructured(
      'Extract info',
      z.object({ name: z.string(), age: z.number() }),
    );
  }
}
```

### Via LLM Factory

```typescript
import { LLMFactory } from './services/llm-factory.service';

@Injectable()
export class MyService {
  constructor(private readonly llmFactory: LLMFactory) {}

  async getResponse(task: string) {
    const { provider, model } = this.llmFactory.selectModel(
      'planning', // task type
      'high', // complexity
    );

    // Use selected model
    const response = await this.llmFactory.invoke(prompt, {
      provider,
      model: model.id,
    });

    return response;
  }
}
```

## Model Routing

The `ModelRoutingService` handles automatic model selection based on:

- Task type (planning, execution, evaluation, etc.)
- Complexity (low, medium, high)
- Provider availability

## Files

```
services/
├── minimax-client.service.ts    # MiniMax implementation
├── deepseek-client.service.ts    # DeepSeek implementation
├── mimo-client.service.ts        # Xiaomi MiMo implementation
├── llm-factory.service.ts        # Factory + model routing
└── model-routing.service.ts      # Model selection logic
```
