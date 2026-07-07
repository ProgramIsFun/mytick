export interface IUser {
  id: string;
  email?: string;
  username: string;
  name: string;
  providers: IAuthProvider[];
  pushTokens: IPushToken[];
  fcmTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuthProvider {
  type: string;
  providerId: string;
  passwordHash?: string;
}

export interface IPushToken {
  token: string;
  provider: string;
  device?: string;
  registeredAt: Date;
}

export interface IUserRepository {
  findAll(): Promise<IUser[]>;
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  findByUsername(username: string): Promise<IUser | null>;
  findByIdentity(providerType: string, providerId: string): Promise<IUser | null>;
  create(data: Partial<IUser> & { providers?: IAuthProvider[] }): Promise<IUser>;
  update(id: string, data: Partial<IUser>): Promise<IUser | null>;
  addPushToken(userId: string, token: IPushToken): Promise<void>;
  removePushToken(userId: string, token: string): Promise<void>;
  getPushTokens(userId: string): Promise<IPushToken[]>;
  addProvider(userId: string, provider: IAuthProvider): Promise<void>;
}
