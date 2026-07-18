import { ConnectorService } from '../../src/modules/connectors/services/connector.service';
import { ConnectorRegistry } from '../../src/modules/connectors/connector.registry';
import { SalesforceConnector } from '../../src/modules/connectors/adapters/salesforce.adapter';
import { HubSpotConnector } from '../../src/modules/connectors/adapters/hubspot.adapter';
import { PipedriveConnector } from '../../src/modules/connectors/adapters/pipedrive.adapter';

const SF_ID = 'conn-sf-1';
const TENANT = 'tenant-abc';

function buildMocks(provider = 'salesforce') {
  const registry = new ConnectorRegistry();
  registry.register(new SalesforceConnector());
  registry.register(new HubSpotConnector());
  registry.register(new PipedriveConnector());

  const prisma: any = {
    crmConnector: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: SF_ID,
          name: 'sf-demo',
          provider,
          isActive: true,
          tenantId: TENANT,
        },
      ]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'new-id', ...data }),
        ),
      findFirst: jest.fn().mockResolvedValue({
        id: SF_ID,
        name: 'sf-demo',
        provider,
        isActive: true,
        tenantId: TENANT,
      }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  };

  const svc = new ConnectorService(prisma, registry);
  return { svc, registry, prisma };
}

describe('ConnectorRegistry', () => {
  it('registers connectors idempotently', () => {
    const r = new ConnectorRegistry();
    r.register(new SalesforceConnector());
    r.register(new SalesforceConnector()); // second call should not throw
    expect(r.list()).toEqual(['salesforce']);
  });

  it('lists all registered providers', () => {
    const r = new ConnectorRegistry();
    r.register(new SalesforceConnector());
    r.register(new HubSpotConnector());
    r.register(new PipedriveConnector());
    expect(r.list()).toEqual(
      expect.arrayContaining(['salesforce', 'hubspot', 'pipedrive']),
    );
  });
});

describe('ConnectorService', () => {
  it('listAvailableProviders() returns registry keys', () => {
    const { svc } = buildMocks();
    expect(svc.listAvailableProviders()).toEqual(
      expect.arrayContaining(['salesforce', 'hubspot', 'pipedrive']),
    );
  });

  it('createConnector() rejects unknown provider', async () => {
    const { svc } = buildMocks();
    await expect(
      svc.createConnector(TENANT, 'My SF', 'unknown-crm', {}),
    ).rejects.toThrow('Provider not supported');
  });

  it('createConnector() saves record for known provider', async () => {
    const { svc, prisma } = buildMocks();
    const rec = await svc.createConnector(TENANT, 'My SF', 'salesforce', {});
    expect(prisma.crmConnector.create).toHaveBeenCalled();
    expect(rec.provider).toBe('salesforce');
  });

  it('connect() calls adapter.connect and updates DB', async () => {
    const { svc, prisma } = buildMocks();
    await svc.connect(TENANT, SF_ID, { apiKey: 'secret' });
    expect(prisma.crmConnector.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SF_ID } }),
    );
  });

  it('syncContacts() resolves for salesforce', async () => {
    const { svc } = buildMocks();
    await expect(
      svc.syncContacts(TENANT, SF_ID),
    ).resolves.not.toThrow();
  });

  it('syncLeads() resolves for hubspot', async () => {
    const { svc, prisma } = buildMocks('hubspot');
    prisma.crmConnector.findFirst.mockResolvedValue({
      id: SF_ID,
      name: 'hs-demo',
      provider: 'hubspot',
      isActive: true,
      tenantId: TENANT,
    });
    await expect(
      svc.syncLeads(TENANT, SF_ID),
    ).resolves.not.toThrow();
  });
});
