// Concurrency tests (PROJECT_PLAN.md §19.5). Needs the API running (bun run dev) and the seed data.
// Run with: bun run test:race      (API_BASE_URL defaults to http://localhost:5000/api/v1)
import config from "../config";

const BASE = (process.env.API_BASE_URL ?? `http://localhost:${config.port}/api/v1`).replace(/\/$/, "");
const RACE_ROOM = "00000000-0000-4000-8000-000000003003"; // seeded 1-seat room (owner@roommatehub.com)
const DUPLICATE_ROOM = "00000000-0000-4000-8000-000000003005"; // seeded 1-seat room, ANY gender

// biome-ignore lint/suspicious/noExplicitAny: test script reads a few fields from API JSON
type TApiResponse = { success: boolean; message: string; data: any };

const call = async (method: string, path: string, token?: string, body?: unknown) => {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token && { Authorization: `Bearer ${token}` }),
		},
		...(body !== undefined && { body: JSON.stringify(body) }),
	});
	return { status: res.status, body: (await res.json()) as TApiResponse };
};

const login = async (email: string) => {
	const res = await call("POST", "/auth/login", undefined, { email, password: config.seed_demo_password });
	if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.body.message}`);
	return res.body.data.accessToken as string;
};

// Leaves no open applications from earlier runs, so the test always starts clean
const withdrawOpen = async (token: string) => {
	for (const status of ["PENDING", "APPROVED"]) {
		const list = await call("GET", `/applications?status=${status}&limit=50`, token);
		for (const application of list.body.data ?? []) {
			await call("PATCH", `/applications/${application.id}/withdraw`, token);
		}
	}
};

const moveInDate = () => {
	const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
	return date.toISOString().slice(0, 10);
};

let failures = 0;
const expectStatuses = (name: string, actual: number[], expected: number[]) => {
	const ok = JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
	if (!ok) failures++;
	console.log(`${ok ? "✓" : "✗"} ${name}: got [${actual.join(", ")}], expected [${expected.join(", ")}]`);
};

const main = async () => {
	if (!config.seed_demo_password) throw new Error("SEED_DEMO_PASSWORD is not set");

	const [owner, tenantA, tenantB] = await Promise.all([
		login("owner@roommatehub.com"),
		login("tenant6@roommatehub.com"),
		login("tenant8@roommatehub.com"),
	]);
	await Promise.all([withdrawOpen(tenantA), withdrawOpen(tenantB)]);

	// Test 1: two approvals for the last seat at the same moment → one 200, one 409
	const [appA, appB] = await Promise.all([
		call("POST", `/rooms/${RACE_ROOM}/applications`, tenantA, { moveInDate: moveInDate() }),
		call("POST", `/rooms/${RACE_ROOM}/applications`, tenantB, { moveInDate: moveInDate() }),
	]);
	if (appA.status !== 201 || appB.status !== 201) {
		throw new Error(`Could not prepare test 1: ${appA.body.message} / ${appB.body.message}`);
	}
	const approvals = await Promise.all([
		call("PATCH", `/applications/${appA.body.data.id}/decision`, owner, { decision: "APPROVE" }),
		call("PATCH", `/applications/${appB.body.data.id}/decision`, owner, { decision: "APPROVE" }),
	]);
	expectStatuses(
		"Two approvals for the last seat",
		approvals.map((r) => r.status),
		[200, 409],
	);

	// Test 2: the same application sent twice at the same moment → one 201, one 409
	const duplicates = await Promise.all([
		call("POST", `/rooms/${DUPLICATE_ROOM}/applications`, tenantA, { moveInDate: moveInDate() }),
		call("POST", `/rooms/${DUPLICATE_ROOM}/applications`, tenantA, { moveInDate: moveInDate() }),
	]);
	expectStatuses(
		"Duplicate application sent twice",
		duplicates.map((r) => r.status),
		[201, 409],
	);

	// Clean up so seats return to their seeded state
	await Promise.all([withdrawOpen(tenantA), withdrawOpen(tenantB)]);

	console.log(failures ? `\n${failures} race test(s) failed.` : "\nAll race tests passed.");
	if (failures) process.exitCode = 1;
};

main().catch((error) => {
	console.error("Race test error:", (error as Error).message);
	process.exitCode = 1;
});
