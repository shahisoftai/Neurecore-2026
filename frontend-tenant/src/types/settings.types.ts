export interface AIRoutingConfig {
  planning: string;
  execution: string;
  evaluation: string;
  conversation: string;
  coding: string;
  reasoning: string;
}

export const DEFAULT_AI_ROUTING: AIRoutingConfig = {
  planning: 'MiniMax-M2.7-highspeed',
  execution: 'MiniMax-M2.7-highspeed',
  evaluation: 'MiniMax-M2.7-highspeed',
  conversation: 'MiniMax-M2.7-highspeed',
  coding: 'MiniMax-M2.7-highspeed',
  reasoning: 'MiniMax-M2.7-highspeed',
};
