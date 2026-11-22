import type { z } from "zod";
import type {
	CreateRoomDataZodSchema,
	RoomListQueryValidationZodSchema,
	UpdateRoomDataZodSchema,
} from "./room.validation";

export type ICreateRoomPayload = z.infer<typeof CreateRoomDataZodSchema>;
export type IUpdateRoomPayload = z.infer<typeof UpdateRoomDataZodSchema>;
export type IRoomListQuery = z.infer<typeof RoomListQueryValidationZodSchema>;
