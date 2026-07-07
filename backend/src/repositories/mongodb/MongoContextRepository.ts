import ContextModel, { IContext as MongoIContext } from '../../models/Context';
import { IContext, IContextRepository } from '../interfaces/IContextRepository';

function toDomain(c: MongoIContext): IContext {
  return { id: c._id.toString(), userId: c.userId.toString(), key: c.key, value: c.value, updatedAt: c.updatedAt };
}

export class MongoContextRepository implements IContextRepository {
  async findByUser(userId: string): Promise<IContext[]> {
    return (await ContextModel.find({ userId }).sort({ key: 1 })).map(toDomain);
  }

  async findByKey(userId: string, key: string): Promise<IContext | null> {
    const c = await ContextModel.findOne({ userId, key });
    return c ? toDomain(c) : null;
  }

  async upsert(userId: string, key: string, value: string): Promise<IContext> {
    const c = await ContextModel.findOneAndUpdate(
      { userId, key }, { value }, { upsert: true, new: true },
    );
    return toDomain(c);
  }

  async delete(userId: string, key: string): Promise<boolean> {
    const c = await ContextModel.findOneAndDelete({ userId, key });
    return !!c;
  }
}
