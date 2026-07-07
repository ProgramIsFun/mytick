import mongoose from 'mongoose';
import UserModel, { IUser as MongoIUser, IAuthProvider as MongoIAuthProvider } from '../../models/User';
import { IUser, IUserRepository, IAuthProvider, IPushToken } from '../interfaces/IUserRepository';

function toDomain(u: MongoIUser): IUser {
  return {
    id: u._id.toString(),
    email: u.email,
    username: u.username,
    name: u.name,
    providers: (u.providers || []).map(p => ({ type: p.type, providerId: p.providerId, passwordHash: p.passwordHash })),
    pushTokens: (u.pushTokens || []).map(t => ({ token: t.token, provider: t.provider, device: t.device, registeredAt: t.registeredAt })),
    fcmTokens: u.fcmTokens || [],
    createdAt: u.createdAt,
    updatedAt: (u as any).updatedAt,
  };
}

export class MongoUserRepository implements IUserRepository {
  async findById(id: string): Promise<IUser | null> {
    const u = await UserModel.findById(id);
    return u ? toDomain(u) : null;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const u = await UserModel.findOne({ email });
    return u ? toDomain(u) : null;
  }

  async findByUsername(username: string): Promise<IUser | null> {
    const u = await UserModel.findOne({ username: username.toLowerCase() });
    return u ? toDomain(u) : null;
  }

  async findByIdentity(providerType: string, providerId: string): Promise<IUser | null> {
    const u = await UserModel.findOne({
      'providers.type': providerType,
      'providers.providerId': providerId,
    });
    return u ? toDomain(u) : null;
  }

  async create(data: Partial<IUser> & { providers?: IAuthProvider[] }): Promise<IUser> {
    const u = await UserModel.create({
      email: data.email,
      username: data.username,
      name: data.name,
      providers: (data.providers || []) as any,
    });
    return toDomain(u);
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    const u = await UserModel.findById(id);
    if (!u) return null;
    if (data.email !== undefined) u.email = data.email;
    if (data.username !== undefined) u.username = data.username;
    if (data.name !== undefined) u.name = data.name;
    await u.save();
    return toDomain(u);
  }

  async addPushToken(userId: string, token: IPushToken): Promise<void> {
    await UserModel.updateOne(
      { _id: userId, 'pushTokens.token': { $ne: token.token } },
      { $push: { pushTokens: { token: token.token, provider: token.provider, device: token.device || '', registeredAt: new Date() } } }
    );
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    await UserModel.updateOne({ _id: userId }, {
      $pull: { fcmTokens: token, pushTokens: { token } },
    });
  }

  async getPushTokens(userId: string): Promise<IPushToken[]> {
    const u = await UserModel.findById(userId).select('pushTokens fcmTokens');
    if (!u) return [];
    if (u.pushTokens?.length) {
      return u.pushTokens.map(t => ({ token: t.token, provider: t.provider, device: t.device, registeredAt: t.registeredAt }));
    }
    return (u.fcmTokens || []).map(t => ({ token: t, provider: 'fcm', device: '', registeredAt: new Date() }));
  }

  async addProvider(userId: string, provider: IAuthProvider): Promise<void> {
    const u = await UserModel.findById(userId);
    if (!u) return;
    u.providers.push(provider as MongoIAuthProvider);
    await u.save();
  }
}
