export interface IRecurrenceException {
  id: string;
  taskId: string;
  date: Date;
  status: 'pending' | 'done' | 'skipped';
  title?: string;
  description?: string;
  newDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecurrenceExceptionRepository {
  findByTaskAndDateRange(taskIds: string[], from: Date, to: Date): Promise<IRecurrenceException[]>;
  upsert(taskId: string, date: Date, data: Partial<IRecurrenceException>): Promise<IRecurrenceException>;
  delete(taskId: string, date: Date): Promise<boolean>;
  deleteByTask(taskId: string, dateFrom?: Date): Promise<number>;
}
