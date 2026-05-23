import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IKnowledge extends Document {
  userId: Types.ObjectId;
  content: string;
}

const knowledgeSchema = new Schema<IKnowledge>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, { timestamps: true });

knowledgeSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IKnowledge>('Knowledge', knowledgeSchema);
