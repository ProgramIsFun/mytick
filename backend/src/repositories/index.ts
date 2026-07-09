import { IUserRepository } from './interfaces/IUserRepository';
import { ITaskRepository } from './interfaces/ITaskRepository';
import { IAccountRepository } from './interfaces/IAccountRepository';
import { IGroupRepository } from './interfaces/IGroupRepository';
import { ISecretRepository } from './interfaces/ISecretRepository';
import { IDomainRepository } from './interfaces/IDomainRepository';
import { IDatabaseRepository } from './interfaces/IDatabaseRepository';
import { ISubscriptionRepository } from './interfaces/ISubscriptionRepository';
import { IKnowledgeRepository } from './interfaces/IKnowledgeRepository';
import { IContextRepository } from './interfaces/IContextRepository';
import { IBackupHistoryRepository } from './interfaces/IBackupHistoryRepository';
import { IRecurrenceExceptionRepository } from './interfaces/IRecurrenceExceptionRepository';

import { Neo4jUserRepository } from './neo4j/Neo4jUserRepository';
import { Neo4jTaskRepository } from './neo4j/Neo4jTaskRepository';
import { Neo4jAccountRepository } from './neo4j/Neo4jAccountRepository';
import { Neo4jGroupRepository } from './neo4j/Neo4jGroupRepository';
import { Neo4jSecretRepository } from './neo4j/Neo4jSecretRepository';
import { Neo4jDomainRepository } from './neo4j/Neo4jDomainRepository';
import { Neo4jDatabaseRepository } from './neo4j/Neo4jDatabaseRepository';
import { Neo4jSubscriptionRepository } from './neo4j/Neo4jSubscriptionRepository';
import { Neo4jKnowledgeRepository } from './neo4j/Neo4jKnowledgeRepository';
import { Neo4jContextRepository } from './neo4j/Neo4jContextRepository';
import { Neo4jBackupHistoryRepository } from './neo4j/Neo4jBackupHistoryRepository';
import { Neo4jRecurrenceExceptionRepository } from './neo4j/Neo4jRecurrenceExceptionRepository';

// Using Neo4j exclusively
export const userRepo: IUserRepository = new Neo4jUserRepository();
export const taskRepo: ITaskRepository = new Neo4jTaskRepository();
export const accountRepo: IAccountRepository = new Neo4jAccountRepository();
export const groupRepo: IGroupRepository = new Neo4jGroupRepository();
export const secretRepo: ISecretRepository = new Neo4jSecretRepository();
export const domainRepo: IDomainRepository = new Neo4jDomainRepository();
export const databaseRepo: IDatabaseRepository = new Neo4jDatabaseRepository();
export const subscriptionRepo: ISubscriptionRepository = new Neo4jSubscriptionRepository();
export const knowledgeRepo: IKnowledgeRepository = new Neo4jKnowledgeRepository();
export const contextRepo: IContextRepository = new Neo4jContextRepository();
export const backupHistoryRepo: IBackupHistoryRepository = new Neo4jBackupHistoryRepository();
export const recurrenceExceptionRepo: IRecurrenceExceptionRepository = new Neo4jRecurrenceExceptionRepository();
