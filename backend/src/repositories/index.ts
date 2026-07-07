import { IUserRepository } from './interfaces/IUserRepository';
import { ITaskRepository } from './interfaces/ITaskRepository';
import { IAccountRepository } from './interfaces/IAccountRepository';
import { IGroupRepository } from './interfaces/IGroupRepository';
import { ISecretRepository } from './interfaces/ISecretRepository';

import { MongoUserRepository } from './mongodb/MongoUserRepository';
import { MongoTaskRepository } from './mongodb/MongoTaskRepository';
import { MongoAccountRepository } from './mongodb/MongoAccountRepository';
import { MongoGroupRepository } from './mongodb/MongoGroupRepository';
import { MongoSecretRepository } from './mongodb/MongoSecretRepository';

import { Neo4jUserRepository } from './neo4j/Neo4jUserRepository';
import { Neo4jTaskRepository } from './neo4j/Neo4jTaskRepository';
import { Neo4jAccountRepository } from './neo4j/Neo4jAccountRepository';
import { Neo4jGroupRepository } from './neo4j/Neo4jGroupRepository';
import { Neo4jSecretRepository } from './neo4j/Neo4jSecretRepository';

const engine = process.env.DB_ENGINE || 'mongodb';
const isNeo4j = engine === 'neo4j';

export const userRepo: IUserRepository = isNeo4j ? new Neo4jUserRepository() : new MongoUserRepository();
export const taskRepo: ITaskRepository = isNeo4j ? new Neo4jTaskRepository() : new MongoTaskRepository();
export const accountRepo: IAccountRepository = isNeo4j ? new Neo4jAccountRepository() : new MongoAccountRepository();
export const groupRepo: IGroupRepository = isNeo4j ? new Neo4jGroupRepository() : new MongoGroupRepository();
export const secretRepo: ISecretRepository = isNeo4j ? new Neo4jSecretRepository() : new MongoSecretRepository();
