import type { RequestUser } from "../middleware/checkAuth";
import type { TValidated } from "./index";

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser;
			validated?: TValidated;
		}
	}
}
