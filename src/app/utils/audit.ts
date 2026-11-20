import type { Prisma } from "../../generated/prisma/client";

type TAuditEntry = {
	actorId: string | null;
	action: string;
	entity: string;
	entityId: string;
	before?: Prisma.InputJsonValue;
	after?: Prisma.InputJsonValue;
};

// Always called with the transaction client, so the log is saved together with the change
const write = (tx: Prisma.TransactionClient, entry: TAuditEntry) => {
	return tx.auditLog.create({
		data: {
			actorId: entry.actorId,
			action: entry.action,
			entity: entry.entity,
			entityId: entry.entityId,
			...(entry.before !== undefined && { before: entry.before }),
			...(entry.after !== undefined && { after: entry.after }),
		},
	});
};

export const auditUtils = {
	write,
};
