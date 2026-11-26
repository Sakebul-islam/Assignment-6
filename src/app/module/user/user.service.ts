import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { userPublicSelect } from "../../utils/selects";
import { uploadUtils } from "../../utils/upload";
import type { IUpdateProfilePayload } from "./user.interface";

const getMyProfile = async (user: RequestUser) => {
	const profile = await prisma.user.findUnique({ where: { id: user.userId }, select: userPublicSelect });
	if (!profile) throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	return profile;
};

const updateMyProfile = async (user: RequestUser, payload: IUpdateProfilePayload) => {
	return prisma.user.update({
		where: { id: user.userId },
		data: payload,
		select: userPublicSelect,
	});
};

// the old image is only deleted after the new one is saved
const updateMyAvatar = async (user: RequestUser, file?: Express.Multer.File) => {
	if (!file) {
		throw new AppError(httpStatus.BAD_REQUEST, "Avatar Image Is Required", [
			{ path: "avatar", message: "Avatar Image Is Required" },
		]);
	}

	const current = await prisma.user.findUnique({ where: { id: user.userId }, select: { avatarPublicId: true } });
	const uploaded = await uploadUtils.uploadBuffer(file.buffer, "roommate-hub/avatars");

	try {
		const updated = await prisma.user.update({
			where: { id: user.userId },
			data: { avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId },
			select: userPublicSelect,
		});
		if (current?.avatarPublicId) await uploadUtils.destroyMany([current.avatarPublicId]);
		return updated;
	} catch (error) {
		await uploadUtils.destroyMany([uploaded.publicId]);
		throw error;
	}
};

export const UserServices = {
	getMyProfile,
	updateMyProfile,
	updateMyAvatar,
};
