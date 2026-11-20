import httpStatus from "http-status";
import { cloudinary } from "../lib/cloudinary";
import { AppError } from "./AppError";

export type TUploadedFile = { url: string; publicId: string };

const uploadBuffer = (buffer: Buffer, folder: string) =>
	new Promise<TUploadedFile>((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
			if (error || !result) {
				console.warn("Cloudinary upload failed:", error?.message);
				reject(new AppError(httpStatus.BAD_GATEWAY, "File Upload Failed"));
				return;
			}
			resolve({ url: result.secure_url, publicId: result.public_id });
		});
		stream.end(buffer);
	});

// Best effort: a failed delete is logged, never thrown
const destroyMany = async (publicIds: string[]) => {
	const results = await Promise.allSettled(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)));
	for (const result of results) {
		if (result.status === "rejected") console.warn("Cloudinary delete failed:", (result.reason as Error)?.message);
	}
};

// Uploads all files; if one fails, the ones already uploaded are deleted again
const uploadMany = async (files: Express.Multer.File[] = [], folder: string) => {
	const uploaded: TUploadedFile[] = [];
	try {
		for (const file of files) {
			uploaded.push(await uploadBuffer(file.buffer, folder));
		}
		return uploaded;
	} catch (error) {
		await destroyMany(uploaded.map((file) => file.publicId));
		throw error;
	}
};

export const uploadUtils = {
	uploadBuffer,
	uploadMany,
	destroyMany,
};
