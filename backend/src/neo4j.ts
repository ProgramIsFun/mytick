import neo4j, { Driver, Session } from 'neo4j-driver';
import { logger } from './utils/logger';

let driver: Driver | null = null;

export async function connectNeo4j(uri: string, user: string, password: string): Promise<Driver> {
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionLifetime: 3 * 60 * 60 * 1000,
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2000,
  });
  await driver.verifyConnectivity();
  logger.info('Neo4j connected');
  return driver;
}

export function getDriver(): Driver {
  if (!driver) throw new Error('Neo4j driver not initialized. Call connectNeo4j() first.');
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    logger.info('Neo4j disconnected');
  }
}
