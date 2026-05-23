import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IKnowledge extends Document {
  userId: Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  source: 'manual' | 'import' | 'ai' | 'web';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeSchema = new Schema<IKnowledge>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
  source: { type: String, enum: ['manual', 'import', 'ai', 'web'], default: 'manual' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

knowledgeSchema.index({ userId: 1, createdAt: -1 });
knowledgeSchema.index({ userId: 1, tags: 1 });
knowledgeSchema.index({ title: 'text', content: 'text' });

export default mongoose.model<IKnowledge>('Knowledge', knowledgeSchema);
