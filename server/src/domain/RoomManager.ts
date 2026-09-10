import { Room } from './Room';

export class RoomManager {
  private roomsById: Map<string, Room> = new Map();
  private roomsByCode: Map<string, Room> = new Map();

  public addRoom(room: Room): void {
    this.roomsById.set(room.id, room);
    this.roomsByCode.set(room.shortCode.toUpperCase(), room);
  }

  public getRoom(roomId: string): Room | undefined {
    return this.roomsById.get(roomId);
  }

  public getRoomByCode(code: string): Room | undefined {
    return this.roomsByCode.get(code.toUpperCase());
  }

  public getRoomByIdOrCode(identifier: string): Room | undefined {
    return this.getRoom(identifier) || this.getRoomByCode(identifier);
  }

  public removeRoom(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (room) {
      this.roomsById.delete(roomId);
      this.roomsByCode.delete(room.shortCode.toUpperCase());
    }
  }

  public getAllRooms(): Room[] {
    return Array.from(this.roomsById.values());
  }

  public findRoomBySocketId(socketId: string): Room | undefined {
    for (const room of this.roomsById.values()) {
      if (room.getParticipantBySocketId(socketId)) {
        return room;
      }
    }
    return undefined;
  }
}
