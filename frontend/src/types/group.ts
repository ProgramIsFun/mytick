export interface Member { userId: string; username?: string; name?: string; role: string; }

export interface Group { _id: string; name: string; ownerId: string; members: Member[]; }
