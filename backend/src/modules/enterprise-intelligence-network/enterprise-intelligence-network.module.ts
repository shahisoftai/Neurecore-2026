import { Module } from '@nestjs/common';
import { EnterpriseCognitionModule } from '../enterprise-cognition/enterprise-cognition.module';
import {
  KNOWLEDGE_GRAPH, ONTOLOGY_MANAGER, ENTITY_RESOLVER, RELATIONSHIP_ENGINE,
  SEMANTIC_SEARCH, KNOWLEDGE_REASONER, ENTERPRISE_INTELLIGENCE,
} from './contracts/enterprise-intelligence.interface';
import {
  OntologyManager, KnowledgeGraph, EntityResolver, RelationshipEngine,
  SemanticSearch, KnowledgeReasoner, EnterpriseIntelligenceNetwork,
} from './engines/intelligence-engines.service';
import { EnterpriseIntelligenceController } from './enterprise-intelligence.controller';

@Module({
  imports: [EnterpriseCognitionModule],
  controllers: [EnterpriseIntelligenceController],
  providers: [
    OntologyManager, { provide: ONTOLOGY_MANAGER, useExisting: OntologyManager },
    KnowledgeGraph, { provide: KNOWLEDGE_GRAPH, useExisting: KnowledgeGraph },
    EntityResolver, { provide: ENTITY_RESOLVER, useExisting: EntityResolver },
    RelationshipEngine, { provide: RELATIONSHIP_ENGINE, useExisting: RelationshipEngine },
    SemanticSearch, { provide: SEMANTIC_SEARCH, useExisting: SemanticSearch },
    KnowledgeReasoner, { provide: KNOWLEDGE_REASONER, useExisting: KnowledgeReasoner },
    EnterpriseIntelligenceNetwork, { provide: ENTERPRISE_INTELLIGENCE, useExisting: EnterpriseIntelligenceNetwork },
  ],
})
export class EnterpriseIntelligenceNetworkModule {}
