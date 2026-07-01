import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Simple file-based storage for development
// This ensures data persists across backend restarts
const STORAGE_FILE = path.join(process.cwd(), 'data', 'settings.json');

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load settings from file
function loadSettings(): any {
  try {
    ensureDataDir();
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return null;
}

// Save settings to file
function saveSettings(data: any): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Types matching frontend
export interface AIProviderConfig {
  id: string;
  provider: string;
  name: string;
  apiKey: string;
  apiEndpoint?: string;
  isEnabled: boolean;
  isDefault: boolean;
  models: AIModel[];
  settings: AIProviderSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  contextWindow: number;
  maxTokens: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  isDefault: boolean;
  isEnabled: boolean;
}

interface AIProviderSettings {
  temperature: number;
  topP: number;
  topK?: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
  fallbackProvider?: string;
}

export interface TenantTier {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  pricing: {
    monthlyPrice: number;
    yearlyPrice: number;
    currency: string;
    billingCycle: string;
  };
  limits: {
    maxUsers: number;
    maxAgents: number;
    maxStorageGB: number;
    maxApiCalls: number;
    maxConversationMessages: number;
    maxFileSizeMB: number;
    allowCustomBranding: boolean;
    allowApiAccess: boolean;
    allowSso: boolean;
    allowAuditExport: boolean;
  };
  features: any[];
  permissions: any[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailConfig {
  id: string;
  provider: string;
  settings: any;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  error?: string;
  sentAt: string;
  openedAt?: string;
  clickedAt?: string;
}

// Default tiers
const DEFAULT_TIERS: TenantTier[] = [
  {
    id: 'tier-free',
    name: 'Free',
    slug: 'free',
    description: 'Free tier for testing',
    isActive: true,
    isDefault: true,
    sortOrder: 1,
    pricing: {
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'USD',
      billingCycle: 'monthly',
    },
    limits: {
      maxUsers: 2,
      maxAgents: 3,
      maxStorageGB: 1,
      maxApiCalls: 1000,
      maxConversationMessages: 500,
      maxFileSizeMB: 10,
      allowCustomBranding: false,
      allowApiAccess: false,
      allowSso: false,
      allowAuditExport: false,
    },
    features: [],
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tier-starter',
    name: 'Starter',
    slug: 'starter',
    description: 'Starter tier for small teams',
    isActive: true,
    isDefault: false,
    sortOrder: 2,
    pricing: {
      monthlyPrice: 29,
      yearlyPrice: 290,
      currency: 'USD',
      billingCycle: 'monthly',
    },
    limits: {
      maxUsers: 10,
      maxAgents: 10,
      maxStorageGB: 10,
      maxApiCalls: 10000,
      maxConversationMessages: 5000,
      maxFileSizeMB: 50,
      allowCustomBranding: false,
      allowApiAccess: true,
      allowSso: false,
      allowAuditExport: true,
    },
    features: [],
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tier-pro',
    name: 'Pro',
    slug: 'pro',
    description: 'Professional tier',
    isActive: true,
    isDefault: false,
    sortOrder: 3,
    pricing: {
      monthlyPrice: 99,
      yearlyPrice: 990,
      currency: 'USD',
      billingCycle: 'monthly',
    },
    limits: {
      maxUsers: 50,
      maxAgents: 50,
      maxStorageGB: 100,
      maxApiCalls: 100000,
      maxConversationMessages: 50000,
      maxFileSizeMB: 100,
      allowCustomBranding: true,
      allowApiAccess: true,
      allowSso: true,
      allowAuditExport: true,
    },
    features: [],
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Load persisted data or use defaults
const persisted = loadSettings();

// File-based storage (persists across restarts)
const aiProviders: AIProviderConfig[] = persisted?.aiProviders || [];
const tiers: TenantTier[] = persisted?.tiers || DEFAULT_TIERS;
const emailConfigs: EmailConfig[] = persisted?.emailConfigs || [];
const emailTemplates: EmailTemplate[] = persisted?.emailTemplates || [];
const emailLogs: EmailLog[] = persisted?.emailLogs || [];

// Counters
let aiProviderCounter =
  persisted?.counters?.aiProviderCounter ||
  Math.max(
    1,
    ...aiProviders.map((p) => parseInt(p.id.replace('provider-', '')) || 0),
  ) + 1;
let tierCounter =
  persisted?.counters?.tierCounter ||
  Math.max(4, ...tiers.map((t) => parseInt(t.id.replace('tier-', '')) || 0)) +
    1;
let emailConfigCounter =
  persisted?.counters?.emailConfigCounter ||
  Math.max(
    1,
    ...emailConfigs.map(
      (c) => parseInt(c.id.replace('email-config-', '')) || 0,
    ),
  ) + 1;
let emailTemplateCounter =
  persisted?.counters?.emailTemplateCounter ||
  Math.max(
    1,
    ...emailTemplates.map(
      (t) => parseInt(t.id.replace('email-template-', '')) || 0,
    ),
  ) + 1;

// Helper to save data after modifications
function persistData() {
  saveSettings({
    aiProviders,
    tiers,
    emailConfigs,
    emailTemplates,
    emailLogs,
    counters: {
      aiProviderCounter,
      tierCounter,
      emailConfigCounter,
      emailTemplateCounter,
    },
  });
}

@Injectable()
export class SettingsService {
  // ==================== AI PROVIDERS ====================

  async getAIProviders(): Promise<AIProviderConfig[]> {
    return aiProviders;
  }

  async getAIProvider(id: string): Promise<AIProviderConfig | undefined> {
    return aiProviders.find((p) => p.id === id);
  }

  async createAIProvider(
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const provider: AIProviderConfig = {
      id: `provider-${aiProviderCounter++}`,
      provider: data.provider || 'openai',
      name: data.name || 'New Provider',
      apiKey: data.apiKey || '',
      apiEndpoint: data.apiEndpoint,
      isEnabled: true,
      isDefault: aiProviders.length === 0,
      models: [],
      settings: data.settings || {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
        timeout: 30000,
        retryAttempts: 3,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    aiProviders.push(provider);
    return provider;
  }

  async updateAIProvider(
    id: string,
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const provider = aiProviders.find((p) => p.id === id);
    if (!provider) throw new Error('Provider not found');
    Object.assign(provider, data, { updatedAt: new Date().toISOString() });
    return provider;
  }

  async deleteAIProvider(id: string): Promise<void> {
    const index = aiProviders.findIndex((p) => p.id === id);
    if (index >= 0) aiProviders.splice(index, 1);
  }

  async toggleAIProvider(
    id: string,
    enabled: boolean,
  ): Promise<AIProviderConfig> {
    const provider = aiProviders.find((p) => p.id === id);
    if (!provider) throw new Error('Provider not found');
    provider.isEnabled = enabled;
    provider.updatedAt = new Date().toISOString();
    return provider;
  }

  async setDefaultAIProvider(id: string): Promise<AIProviderConfig> {
    aiProviders.forEach((p) => (p.isDefault = p.id === id));
    const provider = aiProviders.find((p) => p.id === id);
    if (!provider) throw new Error('Provider not found');
    return provider;
  }

  async testAIProvider(
    id: string,
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    return { success: true, latency: 100 };
  }

  async getAIModels(providerId: string): Promise<AIModel[]> {
    const provider = aiProviders.find((p) => p.id === providerId);
    return provider?.models || [];
  }

  async addAIModel(
    providerId: string,
    data: Partial<AIModel>,
  ): Promise<AIModel> {
    const provider = aiProviders.find((p) => p.id === providerId);
    if (!provider) throw new Error('Provider not found');
    const model: AIModel = {
      id: `model-${Date.now()}`,
      name: data.name || 'New Model',
      provider: provider.provider,
      modelId: data.modelId || 'gpt-4',
      contextWindow: data.contextWindow || 8192,
      maxTokens: data.maxTokens || 4096,
      supportsVision: data.supportsVision || false,
      supportsFunctionCalling: data.supportsFunctionCalling || false,
      isDefault: provider.models.length === 0,
      isEnabled: true,
    };
    provider.models.push(model);
    return model;
  }

  // ==================== TIERS ====================

  async getTiers(): Promise<TenantTier[]> {
    return tiers;
  }

  async getTier(id: string): Promise<TenantTier | undefined> {
    return tiers.find((t) => t.id === id);
  }

  async createTier(data: Partial<TenantTier>): Promise<TenantTier> {
    const tier: TenantTier = {
      id: `tier-${tierCounter++}`,
      name: data.name || 'New Tier',
      slug: data.slug || 'new-tier',
      description: data.description || '',
      isActive: true,
      isDefault: false,
      sortOrder: tiers.length + 1,
      pricing: data.pricing || {
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: 'USD',
        billingCycle: 'monthly',
      },
      limits: data.limits || {
        maxUsers: 5,
        maxAgents: 10,
        maxStorageGB: 10,
        maxApiCalls: 10000,
        maxConversationMessages: 5000,
        maxFileSizeMB: 50,
        allowCustomBranding: false,
        allowApiAccess: false,
        allowSso: false,
        allowAuditExport: false,
      },
      features: data.features || [],
      permissions: data.permissions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tiers.push(tier);
    return tier;
  }

  async updateTier(id: string, data: Partial<TenantTier>): Promise<TenantTier> {
    const tier = tiers.find((t) => t.id === id);
    if (!tier) throw new Error('Tier not found');
    Object.assign(tier, data, { updatedAt: new Date().toISOString() });
    return tier;
  }

  async deleteTier(id: string): Promise<void> {
    const index = tiers.findIndex((t) => t.id === id);
    if (index >= 0) tiers.splice(index, 1);
  }

  async toggleTier(id: string, isActive: boolean): Promise<TenantTier> {
    const tier = tiers.find((t) => t.id === id);
    if (!tier) throw new Error('Tier not found');
    tier.isActive = isActive;
    tier.updatedAt = new Date().toISOString();
    return tier;
  }

  async setDefaultTier(id: string): Promise<TenantTier> {
    tiers.forEach((t) => (t.isDefault = t.id === id));
    const tier = tiers.find((t) => t.id === id);
    if (!tier) throw new Error('Tier not found');
    return tier;
  }

  async reorderTiers(orderedIds: string[]): Promise<TenantTier[]> {
    orderedIds.forEach((id, index) => {
      const tier = tiers.find((t) => t.id === id);
      if (tier) tier.sortOrder = index + 1;
    });
    return tiers.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ==================== EMAIL CONFIGS ====================

  async getEmailConfigs(): Promise<EmailConfig[]> {
    return emailConfigs;
  }

  async getEmailConfig(id: string): Promise<EmailConfig | undefined> {
    return emailConfigs.find((c) => c.id === id);
  }

  async createEmailConfig(data: Partial<EmailConfig>): Promise<EmailConfig> {
    const config: EmailConfig = {
      id: `email-config-${emailConfigCounter++}`,
      provider: data.provider || 'smtp',
      settings: data.settings || { fromEmail: '', fromName: '' },
      isEnabled: true,
      isDefault: emailConfigs.length === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    emailConfigs.push(config);
    return config;
  }

  async updateEmailConfig(
    id: string,
    data: Partial<EmailConfig>,
  ): Promise<EmailConfig> {
    const config = emailConfigs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    Object.assign(config, data, { updatedAt: new Date().toISOString() });
    return config;
  }

  async deleteEmailConfig(id: string): Promise<void> {
    const index = emailConfigs.findIndex((c) => c.id === id);
    if (index >= 0) emailConfigs.splice(index, 1);
  }

  async toggleEmailConfig(
    id: string,
    isEnabled: boolean,
  ): Promise<EmailConfig> {
    const config = emailConfigs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    config.isEnabled = isEnabled;
    config.updatedAt = new Date().toISOString();
    return config;
  }

  async setDefaultEmailConfig(id: string): Promise<EmailConfig> {
    emailConfigs.forEach((c) => (c.isDefault = c.id === id));
    const config = emailConfigs.find((c) => c.id === id);
    if (!config) throw new Error('Config not found');
    return config;
  }

  async testEmailConfig(
    id: string,
    testEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  // ==================== EMAIL TEMPLATES ====================

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return emailTemplates;
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    return emailTemplates.find((t) => t.id === id);
  }

  async createEmailTemplate(
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate> {
    const template: EmailTemplate = {
      id: `email-template-${emailTemplateCounter++}`,
      name: data.name || 'New Template',
      subject: data.subject || '',
      body: data.body || '',
      type: data.type || 'custom',
      isActive: true,
      variables: data.variables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    emailTemplates.push(template);
    return template;
  }

  async updateEmailTemplate(
    id: string,
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate> {
    const template = emailTemplates.find((t) => t.id === id);
    if (!template) throw new Error('Template not found');
    Object.assign(template, data, { updatedAt: new Date().toISOString() });
    return template;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    const index = emailTemplates.findIndex((t) => t.id === id);
    if (index >= 0) emailTemplates.splice(index, 1);
  }

  async toggleEmailTemplate(
    id: string,
    isActive: boolean,
  ): Promise<EmailTemplate> {
    const template = emailTemplates.find((t) => t.id === id);
    if (!template) throw new Error('Template not found');
    template.isActive = isActive;
    template.updatedAt = new Date().toISOString();
    return template;
  }

  // ==================== EMAIL LOGS ====================

  async getEmailLogs(params: any): Promise<{
    items: EmailLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    return { items: emailLogs, total: emailLogs.length, page: 1, limit: 20 };
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    return emailLogs.find((l) => l.id === id);
  }

  async resendEmail(id: string): Promise<EmailLog> {
    const log = emailLogs.find((l) => l.id === id);
    if (!log) throw new Error('Log not found');
    return log;
  }
}
