import httpStatus from "http-status";
import multer from "multer";
import { AppError } from "../utils/AppError";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// memory storage, files go straight to Cloudinary
const imageUpload = (maxFileSizeMb: number, maxFiles: number) =>
	multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: maxFileSizeMb * 1024 * 1024, files: maxFiles },
		fileFilter: (req, file, callback) => {
			if (IMAGE_TYPES.includes(file.mimetype)) {
				callback(null, true);
			} else {
				callback(new AppError(httpStatus.BAD_REQUEST, "Only JPEG, PNG Or WEBP Images Are Allowed"));
			}
		},
	});

export const upload = {
	avatar: imageUpload(2, 1),
	propertyImages: imageUpload(5, 8),
	roomImages: imageUpload(5, 5),
};
