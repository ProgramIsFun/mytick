export interface Member { userId: string; username?: string; name?: string; role: string; }

export interface Group { id: string; name: string; ownerId: string; members: Member[]; }
